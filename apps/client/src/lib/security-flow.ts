import {
  aesGcm,
  createCertificateAuthority,
  hash,
  issueIdentityCertificate,
  random,
  rsa,
  type SessionEncryptedPayload,
  type SessionTicket,
} from "@bsk/crypto";
import { userAuthenticationPayload } from "ttp/contract";

import { service, ttpProtocol, type UserAuthenticationRequest } from "#/api";

import { clientSecurityState, type RegisteredUser } from "./client-security-state";

type RegisteredServer = Awaited<ReturnType<typeof service.state>> & {
  serverId: string;
  certificatePem: string;
};

type DemoFileServiceRequest =
  | {
      kind: "file.upload";
      name: string;
      mimeType: string;
      contentBase64: string;
    }
  | {
      kind: "file.view";
    };

export type DemoFileTransferInput = {
  name: string;
  mimeType: string;
  contentBase64: string;
};

export type DemoFileCurrentResponse = {
  kind: "file.current";
  name: string;
  mimeType: string;
  size: number;
  contentBase64: string;
  storedAt: string;
  encryptedPayload: SessionEncryptedPayload;
};

type ServerDemoFileCurrentResponse = Omit<DemoFileCurrentResponse, "encryptedPayload">;

export type DemoFileServiceResponse =
  | DemoFileCurrentResponse
  | {
      kind: "file.empty";
    };

export const securityFlow = {
  async resetEnvironment() {
    clientSecurityState.reset();
    await service.reset();
  },

  async registerIdentities() {
    await Promise.all([registerUserIdentity(), service.server.register()]);
  },

  async authenticateSession() {
    const user = registeredUser();
    const server = await loadRegisteredServer();
    const serviceRequest = await service.requestService({ userId: user.id });

    const redirect = await ttpProtocol.requestUserAuthentication(serviceRequest.requestId);
    if (redirect.serverId !== server.serverId) {
      throw new Error("TTP redirect references an unexpected server");
    }

    const request = createUserAuthenticationRequest(user, server, {
      requestId: serviceRequest.requestId,
    });

    const userAuth = await ttpProtocol.authenticateUser(request);
    const userSession = decryptSessionTicket(user, userAuth.encryptedSessionKeyForUser);

    if (userSession.sessionId !== userAuth.sessionId) {
      throw new Error("TTP returned inconsistent session identifiers");
    }

    await service.server.fetchKey({ requestId: serviceRequest.requestId });

    clientSecurityState.storeSession({
      sessionId: userAuth.sessionId,
      userSessionKey: userSession.sessionKey,
    });
  },

  uploadDemoFile(input: DemoFileTransferInput) {
    return invokeFileService({
      kind: "file.upload",
      name: input.name,
      mimeType: input.mimeType,
      contentBase64: input.contentBase64,
    });
  },

  viewDemoFile() {
    return invokeFileService({ kind: "file.view" });
  },

  async verifyForgedCertificateIsRejected() {
    const user = registeredUser();
    const server = await loadRegisteredServer();
    const serviceRequest = await service.requestService({ userId: user.id });
    await ttpProtocol.requestUserAuthentication(serviceRequest.requestId);
    const forgedCertificatePem = await createRogueUserCertificate(user);
    const request = createUserAuthenticationRequest(user, server, {
      requestId: serviceRequest.requestId,
      userCertificatePem: forgedCertificatePem,
    });

    try {
      await ttpProtocol.authenticateUser(request);
    } catch (error) {
      return {
        rejected: true,
        message: error instanceof Error ? error.message : "forged certificate rejected",
      };
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

async function registerUserIdentity() {
  const id = hash.of(`user-${random.hex(16)}`).sha256Hex();
  const [authKeyPair, exchangeKeyPair] = await Promise.all([
    rsa.generatePair(),
    rsa.generatePair(),
  ]);
  const registration = await ttpProtocol.registerUser(id, {
    authPublicKeyPem: authKeyPair.publicKeyPem,
    exchangePublicKeyPem: exchangeKeyPair.publicKeyPem,
  });

  clientSecurityState.storeUser({
    id: registration.subjectId,
    authKeyPair,
    exchangeKeyPair,
    certificatePem: registration.certificatePem,
  });
}

async function createRogueUserCertificate(user: RegisteredUser): Promise<string> {
  const rogueAuthority = await createCertificateAuthority({
    commonName: "Untrusted Demo CA",
    organization: "BSK PG MITM Demo",
  });

  return issueIdentityCertificate({
    authority: rogueAuthority,
    role: "user",
    subjectId: user.id,
    publicKeyPem: user.exchangeKeyPair.publicKeyPem,
  });
}

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

async function invokeFileService(
  request: DemoFileServiceRequest,
): Promise<DemoFileServiceResponse> {
  const { sessionId, userSessionKey } = activeSession();
  const sessionCipher = aesGcm.withKey(userSessionKey).forSession(sessionId);
  const encryptedRequest = sessionCipher.encrypt(JSON.stringify(request));
  const response = await service.service.exchange({ payload: encryptedRequest });
  const serverResult = JSON.parse(sessionCipher.decrypt(response.payload)) as
    | ServerDemoFileCurrentResponse
    | Exclude<DemoFileServiceResponse, DemoFileCurrentResponse>;
  const result: DemoFileServiceResponse =
    serverResult.kind === "file.current"
      ? { ...serverResult, encryptedPayload: response.payload }
      : serverResult;

  if (
    request.kind === "file.upload" &&
    (result.kind !== "file.current" ||
      result.name !== request.name ||
      result.mimeType !== request.mimeType ||
      result.contentBase64 !== request.contentBase64)
  ) {
    throw new Error("protected file upload response did not match request");
  }

  return result;
}

function createUserAuthenticationRequest(
  user: RegisteredUser,
  server: RegisteredServer,
  options: {
    requestId: string;
    userCertificatePem?: string;
  },
): UserAuthenticationRequest {
  const request = {
    userId: user.id,
    userCertificatePem: options.userCertificatePem ?? user.certificatePem,
    serverId: server.serverId,
    serverCertificatePem: server.certificatePem,
    requestId: options.requestId,
  };

  return {
    ...request,
    signature: rsa
      .privateKey(user.authKeyPair.privateKeyPem)
      .sign(userAuthenticationPayload(request)),
  };
}

function decryptSessionTicket(user: RegisteredUser, encryptedTicket: string): SessionTicket {
  return JSON.parse(
    rsa.privateKey(user.exchangeKeyPair.privateKeyPem).decrypt(encryptedTicket),
  ) as SessionTicket;
}
