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
import { createRouterClient } from "@orpc/server";
import { beforeEach, describe, expect, it } from "vitest";
import { resetTtpStateForTests, ttpRouter } from "./index.js";

type Role = "user" | "server";

interface PrincipalFixture {
  id: string;
  certificatePem: string;
  exchangePrivateKeyPem: string;
}

const ttp = createRouterClient(ttpRouter);

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
  const payload = await ttp.publicKey();
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
  const payload = await ttp.register({
    role,
    encryptedId: encryptForTtp(publicKeyPem, id),
    publicKeys: {
      authPublicKeyPem: auth.publicKey,
      exchangePublicKeyPem: exchange.publicKey,
    },
  });

  return {
    id: payload.subjectId,
    certificatePem: payload.certificatePem,
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

    const serverAuth = await ttp.auth.server({
      serverId: server.id,
      certificatePem: server.certificatePem,
      requestId,
    });
    expect(serverAuth.ok).toBe(true);

    const publicKeyPem = await ttpPublicKey();
    const payload = await ttp.auth.user({
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
    });

    expect(payload.ok).toBe(true);
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

    await expect(
      ttp.auth.user({
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
    ).rejects.toThrow();
  });

  it("closes sessions after successful authentication", async () => {
    const user = await registerPrincipal("user");
    const server = await registerPrincipal("server");
    const publicKeyPem = await ttpPublicKey();
    const payload = await ttp.auth.user({
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
    });
    const close = await ttp.session.close({
      sessionId: payload.sessionId,
    });

    expect(close).toMatchObject({ ok: true, sessionId: payload.sessionId });
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
