import {
  hash,
  rsa,
  signedPayload,
  type SessionTicket,
} from "@bsk/crypto";
import { createRouterClient } from "@orpc/server";
import { beforeEach, describe, expect, it } from "vitest";
import { resetTtpStateForTests, ttpRouter } from "./index";

type Role = "user" | "server";

interface PrincipalFixture {
  id: string;
  certificatePem: string;
  authPrivateKeyPem: string;
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
    authPrivateKeyPem: auth.privateKeyPem,
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
      signature: signServerAuth(server, requestId),
    });
    expect(serverAuth.ok).toBe(true);

    const publicKeyPem = await ttpPublicKey();
    const payload = await ttp.auth.user({
      encryptedAuthMaterial: rsa
        .publicKey(publicKeyPem)
        .encrypt(
          JSON.stringify(signedUserRequest(user, server, requestId)),
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

  it("rejects an invalid server authentication signature", async () => {
    const server = await registerPrincipal("server");

    await expect(
      ttp.auth.server({
        serverId: server.id,
        certificatePem: server.certificatePem,
        requestId: "bad-server-signature",
        signature: rsa.privateKey(server.authPrivateKeyPem).sign("wrong payload"),
      }),
    ).rejects.toThrow();
  });

  it("rejects an invalid user authentication signature", async () => {
    const user = await registerPrincipal("user");
    const server = await registerPrincipal("server");
    const publicKeyPem = await ttpPublicKey();
    const request = signedUserRequest(user, server, "bad-user-signature");

    await expect(
      ttp.auth.user({
        encryptedAuthMaterial: rsa
          .publicKey(publicKeyPem)
          .encrypt(
            JSON.stringify({
              ...request,
              signature: rsa.privateKey(user.authPrivateKeyPem).sign("wrong payload"),
            }),
          ),
      }),
    ).rejects.toThrow();
  });

  it("rejects a forged user certificate", async () => {
    const user = await registerPrincipal("user");
    const server = await registerPrincipal("server");
    const publicKeyPem = await ttpPublicKey();

    await expect(
      ttp.auth.user({
        encryptedAuthMaterial: rsa
          .publicKey(publicKeyPem)
          .encrypt(
            JSON.stringify(signedUserRequest(user, server, "forged-cert", server.certificatePem)),
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
        .encrypt(
          JSON.stringify(signedUserRequest(user, server, "close-session")),
        ),
    });
    const close = await ttp.session.close({
      sessionId: payload.sessionId,
    });

    expect(close).toMatchObject({ ok: true, sessionId: payload.sessionId });
  });
});

function signServerAuth(server: PrincipalFixture, requestId: string) {
  return rsa.privateKey(server.authPrivateKeyPem).sign(
    signedPayload.from({
      certificateHash: hash.of(server.certificatePem).sha256Hex(),
      requestId,
      role: "server",
      serverId: server.id,
    }),
  );
}

function signedUserRequest(
  user: PrincipalFixture,
  server: PrincipalFixture,
  requestId: string,
  userCertificatePem = user.certificatePem,
) {
  const request = {
    userId: user.id,
    userCertificatePem,
    serverId: server.id,
    serverCertificatePem: server.certificatePem,
    requestId,
  };

  return {
    ...request,
    signature: rsa.privateKey(user.authPrivateKeyPem).sign(
      signedPayload.from({
        requestId: request.requestId,
        role: "user",
        serverCertificateHash: hash.of(request.serverCertificatePem).sha256Hex(),
        serverId: request.serverId,
        userCertificateHash: hash.of(request.userCertificatePem).sha256Hex(),
        userId: request.userId,
      }),
    ),
  };
}
