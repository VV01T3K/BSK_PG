import { aesGcm, hash, random, rsa, type SessionTicket } from "@bsk/crypto";
import { service, ttpProtocol, type UserAuthenticationRequest } from "#/api";
import { clientSecurityState, type RegisteredUser } from "./client-security-state";

type RegisteredServer = Awaited<ReturnType<typeof service.state>> & { serverId: string; certificatePem: string };

/** Browser-side protocol steps. React components use these through useSecurityFlow(). */
export const securityFlow = {
  async resetEnvironment() {
    clientSecurityState.reset();
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

    clientSecurityState.storeUser({
      id: registration.subjectId,
      exchangeKeyPair,
      certificatePem: registration.certificatePem,
    });
    await service.server.register();
  },

  async authenticateSession() {
    const user = registeredUser();
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

    clientSecurityState.storeSession({
      sessionId: userAuth.sessionId,
      userSessionKey: userSession.sessionKey,
      expiresAt: userAuth.expiresAt,
    });
  },

  async sendEncryptedServiceRequest() {
    const { sessionId, userSessionKey } = activeSession();
    const user = registeredUser();
    const requestPlaintext = `User ${user.id.slice(0, 12)} requests the protected grade-summary service.`;
    const encryptedRequest = aesGcm
      .withKey(userSessionKey)
      .forSession(sessionId)
      .encrypt(requestPlaintext);

    await service.service.exchange({ payload: encryptedRequest });
  },

  async verifyForgedCertificateIsRejected() {
    const user = registeredUser();
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
    const session = activeSession();
    await ttpProtocol.closeSession(session.sessionId);
    await service.server.closeSession();
    clientSecurityState.clearSession();
  },
};

function registeredUser() {
  const { user } = clientSecurityState.read();
  if (!user) throw new Error("user is not registered yet");
  return user;
}

function activeSession() {
  const { session } = clientSecurityState.read();
  if (!session) throw new Error("session is not established yet");
  return session;
}

async function loadRegisteredServer() {
  const server = await service.state();
  if (!server.registered || !server.serverId || !server.certificatePem) {
    throw new Error("protected service server is not registered yet");
  }
  return server as RegisteredServer;
}

function createUserAuthenticationRequest(
  user: RegisteredUser,
  server: RegisteredServer,
  userCertificatePem = user.certificatePem,
): UserAuthenticationRequest {
  return {
    userId: user.id,
    userCertificatePem,
    serverId: server.serverId,
    serverCertificatePem: server.certificatePem,
    requestId: random.uuid(),
  };
}

function decryptSessionTicket(user: RegisteredUser, encryptedTicket: string): SessionTicket {
  return JSON.parse(rsa.privateKey(user.exchangeKeyPair.privateKeyPem).decrypt(encryptedTicket)) as SessionTicket;
}
