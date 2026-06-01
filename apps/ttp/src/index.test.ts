import { beforeEach, describe, expect, it } from "bun:test";

import { hash, random, rsa, signedPayload, type SessionTicket } from "@bsk/crypto";
import { createRouterClient } from "@orpc/server";

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
  const id = hash.of(`${role}-test-id-${random.uuid()}`).sha256Hex();
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
      userId: user.id,
      signature: signServerAuth(server, requestId, user.id),
    });
    expect(serverAuth.ok).toBe(true);

    const publicKeyPem = await ttpPublicKey();
    const payload = await ttp.auth.user({
      encryptedAuthMaterial: rsa
        .publicKey(publicKeyPem)
        .encrypt(JSON.stringify(signedUserRequest(user, server, requestId))),
    });

    expect(payload.ok).toBe(true);
    const serverKey = await ttp.session.serverKey({ requestId });
    const userSession = JSON.parse(
      rsa.privateKey(user.exchangePrivateKeyPem).decrypt(payload.encryptedSessionKeyForUser),
    ) as SessionTicket;
    const serverSession = JSON.parse(
      rsa.privateKey(server.exchangePrivateKeyPem).decrypt(serverKey.encryptedSessionKeyForServer),
    ) as SessionTicket;

    expect(userSession.sessionId).toBe(payload.sessionId);
    expect(serverSession.sessionId).toBe(payload.sessionId);
    expect(serverKey.sessionId).toBe(payload.sessionId);
    expect(serverSession.sessionKey).toBe(userSession.sessionKey);
    expect(Buffer.from(userSession.sessionKey, "base64")).toHaveLength(32);
    expect(Buffer.from(serverSession.sessionKey, "base64")).toHaveLength(32);
  }, 10000);

  it("rejects an invalid server authentication signature", async () => {
    const server = await registerPrincipal("server");

    await expect(
      ttp.auth.server({
        serverId: server.id,
        certificatePem: server.certificatePem,
        requestId: "bad-server-signature",
        userId: "expected-user",
        signature: rsa.privateKey(server.authPrivateKeyPem).sign("wrong payload"),
      }),
    ).rejects.toThrow();
  }, 10000);

  it("rejects an invalid user authentication signature", async () => {
    const user = await registerPrincipal("user");
    const server = await registerPrincipal("server");
    const publicKeyPem = await ttpPublicKey();
    const requestId = "bad-user-signature";
    const request = signedUserRequest(user, server, requestId);

    await authenticateServerForUser(server, user, requestId);

    await expect(
      ttp.auth.user({
        encryptedAuthMaterial: rsa.publicKey(publicKeyPem).encrypt(
          JSON.stringify({
            ...request,
            signature: rsa.privateKey(user.authPrivateKeyPem).sign("wrong payload"),
          }),
        ),
      }),
    ).rejects.toThrow();
  }, 10000);

  it("rejects a forged user certificate", async () => {
    const user = await registerPrincipal("user");
    const server = await registerPrincipal("server");
    const publicKeyPem = await ttpPublicKey();
    const requestId = "forged-cert";

    await authenticateServerForUser(server, user, requestId);

    await expect(
      ttp.auth.user({
        encryptedAuthMaterial: rsa
          .publicKey(publicKeyPem)
          .encrypt(
            JSON.stringify(signedUserRequest(user, server, requestId, server.certificatePem)),
          ),
      }),
    ).rejects.toThrow();
  }, 10000);

  it("rejects user authentication without a matching server-initiated request", async () => {
    const user = await registerPrincipal("user");
    const server = await registerPrincipal("server");
    const publicKeyPem = await ttpPublicKey();

    await expect(
      ttp.auth.user({
        encryptedAuthMaterial: rsa
          .publicKey(publicKeyPem)
          .encrypt(JSON.stringify(signedUserRequest(user, server, "unknown-request"))),
      }),
    ).rejects.toThrow();
  }, 10000);

  it("rejects user authentication that does not match the pending user", async () => {
    const expectedUser = await registerPrincipal("user");
    const otherUser = await registerPrincipal("user");
    const server = await registerPrincipal("server");
    const publicKeyPem = await ttpPublicKey();
    const requestId = "mismatched-user";

    await authenticateServerForUser(server, expectedUser, requestId);

    await expect(
      ttp.auth.user({
        encryptedAuthMaterial: rsa
          .publicKey(publicKeyPem)
          .encrypt(JSON.stringify(signedUserRequest(otherUser, server, requestId))),
      }),
    ).rejects.toThrow();
  }, 10000);

  it("closes sessions after successful authentication", async () => {
    const user = await registerPrincipal("user");
    const server = await registerPrincipal("server");
    const publicKeyPem = await ttpPublicKey();
    const requestId = "close-session";

    await authenticateServerForUser(server, user, requestId);

    const payload = await ttp.auth.user({
      encryptedAuthMaterial: rsa
        .publicKey(publicKeyPem)
        .encrypt(JSON.stringify(signedUserRequest(user, server, requestId))),
    });
    const close = await ttp.session.close({
      sessionId: payload.sessionId,
    });

    expect(close).toMatchObject({ ok: true, sessionId: payload.sessionId });
  }, 10000);
});

async function authenticateServerForUser(
  server: PrincipalFixture,
  user: PrincipalFixture,
  requestId: string,
) {
  return ttp.auth.server({
    serverId: server.id,
    certificatePem: server.certificatePem,
    requestId,
    userId: user.id,
    signature: signServerAuth(server, requestId, user.id),
  });
}

function signServerAuth(server: PrincipalFixture, requestId: string, userId: string) {
  return rsa.privateKey(server.authPrivateKeyPem).sign(
    signedPayload.from({
      certificateHash: hash.of(server.certificatePem).sha256Hex(),
      requestId,
      role: "server",
      serverId: server.id,
      userId,
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
