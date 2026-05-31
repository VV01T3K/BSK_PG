import {
  aesGcm,
  hash,
  random,
  rsa,
  type SessionTicket,
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

async function registerPrincipal(role: Role): Promise<PrincipalFixture> {
  const publicKeyPem = await ttpPublicKey();
  const id = hash.of(`${role}-test-id`).sha256Hex();
  const auth = rsa.generatePair();
  const exchange = rsa.generatePair();
  const payload = await ttp.register({
    role,
    encryptedId: rsa.publicKey(publicKeyPem).encrypt(id),
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
      encryptedAuthMaterial: rsa
        .publicKey(publicKeyPem)
        .encryptHybrid(
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
    const userSession = JSON.parse(
      rsa
        .privateKey(user.exchangePrivateKeyPem)
        .decrypt(payload.encryptedSessionKeyForUser),
    ) as SessionTicket;
    const serverSession = JSON.parse(
      rsa
        .privateKey(server.exchangePrivateKeyPem)
        .decrypt(payload.encryptedSessionKeyForServer),
    ) as SessionTicket;

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
        encryptedAuthMaterial: rsa
          .publicKey(publicKeyPem)
          .encryptHybrid(
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
      encryptedAuthMaterial: rsa
        .publicKey(publicKeyPem)
        .encryptHybrid(
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
    const key = random.sessionKey();
    const envelope = aesGcm
      .withKey(key)
      .forSession("session-1")
      .encrypt("classified service payload");
    const plaintext = aesGcm.withKey(key).decrypt(envelope);

    expect(plaintext).toBe("classified service payload");
  });
});
