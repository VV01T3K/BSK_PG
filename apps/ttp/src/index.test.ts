import {
  decryptAesGcm,
  encryptAesGcm,
  encryptHybridForPublicKey,
  generateRsaPair,
  newSessionKey,
  rsaDecryptBase64,
  rsaEncryptBase64,
  sha256Hex,
} from "@bsk/crypto";
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

async function ttpPublicKey(): Promise<string> {
  const payload = await ttp.publicKey();
  return payload.publicKeyPem;
}

function decryptSession(privateKeyPem: string, payloadBase64: string): { sessionId: string; sessionKey: string } {
  return JSON.parse(rsaDecryptBase64(privateKeyPem, payloadBase64)) as { sessionId: string; sessionKey: string };
}

async function registerPrincipal(role: Role): Promise<PrincipalFixture> {
  const publicKeyPem = await ttpPublicKey();
  const id = sha256Hex(`${role}-test-id`);
  const auth = generateRsaPair();
  const exchange = generateRsaPair();
  const payload = await ttp.register({
    role,
    encryptedId: rsaEncryptBase64(publicKeyPem, id),
    publicKeys: {
      authPublicKeyPem: auth.publicKeyPem,
      exchangePublicKeyPem: exchange.publicKeyPem,
    },
  });

  return {
    id: payload.subjectId,
    certificatePem: payload.certificatePem,
    exchangePrivateKeyPem: exchange.privateKeyPem,
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
      encryptedAuthMaterial: encryptHybridForPublicKey(
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
        encryptedAuthMaterial: encryptHybridForPublicKey(
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
      encryptedAuthMaterial: encryptHybridForPublicKey(
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
    const key = newSessionKey();
    const envelope = encryptAesGcm("session-1", key, "classified service payload");
    const plaintext = decryptAesGcm(key, envelope);

    expect(plaintext).toBe("classified service payload");
  });
});
