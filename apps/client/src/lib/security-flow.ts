import { aesGcm, hash, random, rsa, type SessionTicket } from "@bsk/crypto";
import { service, ttpProtocol, type UserAuthenticationRequest } from "#/api";
import { clearClientState, requireSession, requireUser, state } from "./state";
import type { PrincipalState } from "./types";

type RegisteredServer = Awaited<ReturnType<typeof service.state>> & { serverId: string; certificatePem: string };

/** Browser-side protocol steps. React components use these through useSecurityFlow(). */
export const securityFlow = {
  async resetEnvironment() {
    clearClientState();
    await service.reset();
  },

  async registerPrincipals() {
    const id = hash.of(`user-${random.hex(16)}`).sha256Hex();
    const authKeyPair = rsa.generatePair();
    const exchangeKeyPair = rsa.generatePair();
    const registration = await ttpProtocol.registerUser(id, {
      authPublicKeyPem: authKeyPair.publicKeyPem,
      exchangePublicKeyPem: exchangeKeyPair.publicKeyPem,
    });

    state.user = { id: registration.subjectId, exchangeKeyPair, certificatePem: registration.certificatePem };
    state.session = undefined;
    await service.server.register();
  },

  async authenticateSession() {
    const user = requireUser();
    const request = createUserAuthenticationRequest(user, await loadRegisteredServer());

    await service.server.authenticate({ requestId: request.requestId });
    const userAuth = await ttpProtocol.authenticateUser(request);
    const userSession = decryptSessionTicket(user, userAuth.encryptedSessionKeyForUser);

    if (userSession.sessionId !== userAuth.sessionId) {
      throw new Error("TTP returned inconsistent session identifiers");
    }

    await service.server.acceptSession({
      sessionId: userAuth.sessionId,
      encryptedSessionKeyForServer: userAuth.encryptedSessionKeyForServer,
      expiresAt: userAuth.expiresAt,
    });

    state.session = {
      sessionId: userAuth.sessionId,
      userSessionKey: userSession.sessionKey,
      expiresAt: userAuth.expiresAt,
    };
  },

  async sendEncryptedServiceRequest() {
    const { sessionId, userSessionKey } = requireSession();
    const user = requireUser();
    const requestPlaintext = `User ${user.id.slice(0, 12)} requests the protected grade-summary service.`;
    const encryptedRequest = aesGcm
      .withKey(userSessionKey)
      .forSession(sessionId)
      .encrypt(requestPlaintext);

    await service.service.exchange({ payload: encryptedRequest });
  },

  async verifyForgedCertificateIsRejected() {
    const user = requireUser();
    const server = await loadRegisteredServer();
    const request = createUserAuthenticationRequest(user, server, server.certificatePem);

    try {
      await ttpProtocol.authenticateUser(request);
    } catch (error) {
      return { rejected: true, message: error instanceof Error ? error.message : "forged certificate rejected" };
    }

    throw new Error("forged certificate was unexpectedly accepted");
  },

  async closeSession() {
    const session = requireSession();
    await ttpProtocol.closeSession(session.sessionId);
    await service.server.closeSession();
    state.session = undefined;
  },
};

async function loadRegisteredServer() {
  const server = await service.state();
  if (!server.registered || !server.serverId || !server.certificatePem) {
    throw new Error("protected service server is not registered yet");
  }
  return server as RegisteredServer;
}

function createUserAuthenticationRequest(
  user: PrincipalState,
  server: RegisteredServer,
  userCertificatePem = user.certificatePem,
): UserAuthenticationRequest {
  return {
    userId: user.id,
    userCertificatePem,
    serverId: server.serverId,
    serverCertificatePem: server.certificatePem,
    requestId: crypto.randomUUID(),
  };
}

function decryptSessionTicket(user: PrincipalState, encryptedTicket: string): SessionTicket {
  return JSON.parse(rsa.privateKey(user.exchangeKeyPair.privateKeyPem).decrypt(encryptedTicket)) as SessionTicket;
}
