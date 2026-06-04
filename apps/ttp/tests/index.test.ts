import { beforeEach, describe, expect, it } from "bun:test";

import {
  createCertificateAuthority,
  hash,
  issueIdentityCertificate,
  random,
  rsa,
  type SessionTicket,
} from "@bsk/crypto";
import { createRouterClient } from "@orpc/server";

import { ttpRouter } from "../src";
import { serverAuthenticationPayload, userAuthenticationPayload } from "../src/contract";
import { resetTtpTestState } from "./support/state";

type Role = "user" | "server";
type Fixture = {
  id: string;
  certificatePem: string;
  authPrivateKeyPem: string;
  exchangePrivateKeyPem: string;
  exchangePublicKeyPem: string;
};

const ttp = createRouterClient(ttpRouter);

describe("TTP authority", () => {
  beforeEach(resetTtpTestState);

  it("issues one shared AES session key after both parties authenticate", async () => {
    const user = await register("user");
    const server = await register("server");
    const requestId = "request-1";

    await authenticateServer(server, user, requestId);
    const userAuth = await authenticateUser(user, server, requestId);
    const serverKey = await ttp.session.serverKey({ requestId });
    const userTicket = decryptTicket(
      user.exchangePrivateKeyPem,
      userAuth.encryptedSessionKeyForUser,
    );
    const serverTicket = decryptTicket(
      server.exchangePrivateKeyPem,
      serverKey.encryptedSessionKeyForServer,
    );

    expect(userTicket.sessionId).toBe(userAuth.sessionId);
    expect(serverTicket.sessionKey).toBe(userTicket.sessionKey);
    expect(Buffer.from(userTicket.sessionKey, "base64")).toHaveLength(32);
  }, 20_000);

  it("rejects a rogue CA certificate for the right user", async () => {
    const user = await register("user");
    const server = await register("server");
    const requestId = "forged-cert";
    const rogueAuthority = await createCertificateAuthority({
      commonName: "Rogue Test CA",
      organization: "Attacker",
    });
    const forgedCertificatePem = issueIdentityCertificate({
      authority: rogueAuthority,
      role: "user",
      subjectId: user.id,
      publicKeyPem: user.exchangePublicKeyPem,
    });

    await authenticateServer(server, user, requestId);
    await expect(authenticateUser(user, server, requestId, forgedCertificatePem)).rejects.toThrow(
      /trusted authority|certificate/,
    );
  }, 20_000);
});

async function register(role: Role): Promise<Fixture> {
  const ttpKey = (await ttp.publicKey()).publicKeyPem;
  const id = hash.of(`${role}-${random.uuid()}`).sha256Hex();
  const [auth, exchange] = await Promise.all([rsa.generatePair(), rsa.generatePair()]);
  const registration = await ttp.register({
    role,
    encryptedId: rsa.publicKey(ttpKey).encrypt(id),
    publicKeys: {
      authPublicKeyPem: auth.publicKeyPem,
      exchangePublicKeyPem: exchange.publicKeyPem,
    },
  });

  return {
    id: registration.subjectId,
    certificatePem: registration.certificatePem,
    authPrivateKeyPem: auth.privateKeyPem,
    exchangePrivateKeyPem: exchange.privateKeyPem,
    exchangePublicKeyPem: exchange.publicKeyPem,
  };
}

async function authenticateServer(server: Fixture, user: Fixture, requestId: string) {
  const claim = {
    certificatePem: server.certificatePem,
    requestId,
    serverId: server.id,
    userId: user.id,
  };

  await ttp.auth.server({
    ...claim,
    signature: rsa.privateKey(server.authPrivateKeyPem).sign(serverAuthenticationPayload(claim)),
  });
}

async function authenticateUser(
  user: Fixture,
  server: Fixture,
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
  const ttpKey = (await ttp.publicKey()).publicKeyPem;

  return ttp.auth.user({
    encryptedAuthMaterial: rsa.publicKey(ttpKey).encrypt(
      JSON.stringify({
        ...request,
        signature: rsa.privateKey(user.authPrivateKeyPem).sign(userAuthenticationPayload(request)),
      }),
    ),
  });
}

function decryptTicket(privateKeyPem: string, encryptedTicket: string): SessionTicket {
  return JSON.parse(rsa.privateKey(privateKeyPem).decrypt(encryptedTicket)) as SessionTicket;
}
