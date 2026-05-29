import {
  constants,
  createCipheriv,
  createDecipheriv,
  createHash,
  generateKeyPairSync,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
} from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { app, resetTtpStateForTests, type RegisterResponse, type UserAuthResponse } from "./index.js";

type Role = "user" | "server";

interface PrincipalFixture {
  id: string;
  certificatePem: string;
  authPrivateKeyPem: string;
  exchangePrivateKeyPem: string;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function generateRsaPair() {
  return generateKeyPairSync("rsa", {
    modulusLength: 4096,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });
}

async function ttpPublicKey(): Promise<string> {
  const response = await app.request("/api/ttp/public-key");
  const payload = await response.json();
  return payload.publicKeyPem;
}

function encryptForTtp(publicKeyPem: string, plaintext: string): string {
  return publicEncrypt(
    {
      key: publicKeyPem,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(plaintext, "utf8"),
  ).toString("base64");
}

function encryptLargePayloadForTtp(publicKeyPem: string, plaintext: string): string {
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

  return Buffer.from(
    JSON.stringify({
      encryptedKey: encryptForTtp(publicKeyPem, key.toString("base64")),
      iv: iv.toString("base64"),
      ciphertext: ciphertext.toString("base64"),
      authTag: cipher.getAuthTag().toString("base64"),
    }),
  ).toString("base64");
}

function decryptSession(privateKeyPem: string, payloadBase64: string): { sessionId: string; sessionKey: string } {
  return JSON.parse(
    privateDecrypt(
      {
        key: privateKeyPem,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(payloadBase64, "base64"),
    ).toString("utf8"),
  );
}

async function registerPrincipal(role: Role): Promise<PrincipalFixture> {
  const publicKeyPem = await ttpPublicKey();
  const id = sha256(`${role}-test-id`);
  const auth = generateRsaPair();
  const exchange = generateRsaPair();
  const response = await app.request("/api/register", {
    method: "POST",
    body: JSON.stringify({
      role,
      encryptedId: encryptForTtp(publicKeyPem, id),
      publicKeys: {
        authPublicKeyPem: auth.publicKey,
        exchangePublicKeyPem: exchange.publicKey,
      },
    }),
    headers: { "Content-Type": "application/json" },
  });

  expect(response.status).toBe(200);
  const payload = (await response.json()) as RegisterResponse;

  return {
    id: payload.subjectId,
    certificatePem: payload.certificatePem,
    authPrivateKeyPem: auth.privateKey,
    exchangePrivateKeyPem: exchange.privateKey,
  };
}

describe("TTP authority", () => {
  beforeEach(() => {
    resetTtpStateForTests();
  });

  it("registers principals, validates certificates, and distributes AES-256 session keys", async () => {
    const user = await registerPrincipal("user");
    const server = await registerPrincipal("server");
    const requestId = "request-1";

    const serverAuth = await app.request("/api/auth/server", {
      method: "POST",
      body: JSON.stringify({
        serverId: server.id,
        certificatePem: server.certificatePem,
        requestId,
      }),
      headers: { "Content-Type": "application/json" },
    });
    expect(serverAuth.status).toBe(200);

    const publicKeyPem = await ttpPublicKey();
    const userAuth = await app.request("/api/auth/user", {
      method: "POST",
      body: JSON.stringify({
        encryptedAuthMaterial: encryptLargePayloadForTtp(
          publicKeyPem,
          JSON.stringify({
            userId: user.id,
            userCertificatePem: user.certificatePem,
            serverId: server.id,
            serverCertificatePem: server.certificatePem,
            requestId,
          }),
        ),
      }),
      headers: { "Content-Type": "application/json" },
    });

    expect(userAuth.status).toBe(200);
    const payload = (await userAuth.json()) as UserAuthResponse;
    const userSession = decryptSession(user.exchangePrivateKeyPem, payload.encryptedSessionKeyForUser);
    const serverSession = decryptSession(server.exchangePrivateKeyPem, payload.encryptedSessionKeyForServer);

    expect(userSession.sessionId).toBe(payload.sessionId);
    expect(serverSession.sessionId).toBe(payload.sessionId);
    expect(Buffer.from(userSession.sessionKey, "base64")).toHaveLength(32);
    expect(Buffer.from(serverSession.sessionKey, "base64")).toHaveLength(32);
  });

  it("rejects a forged user certificate", async () => {
    const user = await registerPrincipal("user");
    const server = await registerPrincipal("server");
    const publicKeyPem = await ttpPublicKey();

    const response = await app.request("/api/auth/user", {
      method: "POST",
      body: JSON.stringify({
        encryptedAuthMaterial: encryptLargePayloadForTtp(
          publicKeyPem,
          JSON.stringify({
            userId: user.id,
            userCertificatePem: server.certificatePem,
            serverId: server.id,
            serverCertificatePem: server.certificatePem,
            requestId: "forged-cert",
          }),
        ),
      }),
      headers: { "Content-Type": "application/json" },
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ ok: false });
  });

  it("resets principals and sessions", async () => {
    await registerPrincipal("user");
    const response = await app.request("/api/reset", { method: "POST" });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      registeredPrincipals: 0,
      activeSessions: 0,
    });
    const health = await app.request("/api/health");
    expect(await health.json()).toMatchObject({ registeredPrincipals: 0, activeSessions: 0 });
  });

  it("closes sessions after successful authentication", async () => {
    const user = await registerPrincipal("user");
    const server = await registerPrincipal("server");
    const publicKeyPem = await ttpPublicKey();
    const userAuth = await app.request("/api/auth/user", {
      method: "POST",
      body: JSON.stringify({
        encryptedAuthMaterial: encryptLargePayloadForTtp(
          publicKeyPem,
          JSON.stringify({
            userId: user.id,
            userCertificatePem: user.certificatePem,
            serverId: server.id,
            serverCertificatePem: server.certificatePem,
            requestId: "close-session",
          }),
        ),
      }),
      headers: { "Content-Type": "application/json" },
    });
    const payload = (await userAuth.json()) as UserAuthResponse;

    const close = await app.request("/api/session/close", {
      method: "POST",
      body: JSON.stringify({ sessionId: payload.sessionId }),
      headers: { "Content-Type": "application/json" },
    });

    expect(close.status).toBe(200);
    expect(await close.json()).toMatchObject({ ok: true, sessionId: payload.sessionId });
  });

  it("performs an AES-256-GCM encryption and decryption round trip", () => {
    const key = randomBytes(32);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update("classified service payload", "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");

    expect(plaintext).toBe("classified service payload");
  });
});
