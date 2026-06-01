import { hash, random, rsa, signedPayload, type SessionTicket } from "@bsk/crypto";

import { issueCertificate, validateCertificate } from "./certificates";
import { ca } from "./crypto";
import { pendingAuths, principalKey, principals, sessions } from "./state";
import type { PrincipalRecord, Role, SessionRecord } from "./types";

export type PrincipalPublicKeys = PrincipalRecord["publicKeys"];

export type RegisterPrincipalInput = {
  role: Role;
  encryptedId: string;
  publicKeys: PrincipalPublicKeys;
};

export type ServerAuthenticationInput = {
  serverId: string;
  certificatePem: string;
  requestId: string;
  userId: string;
  signature: string;
};

export type UserAuthenticationRequest = {
  userId: string;
  userCertificatePem: string;
  serverId: string;
  serverCertificatePem: string;
  requestId: string;
  signature: string;
};

export type UserAuthenticationInput = {
  encryptedAuthMaterial: string;
};

export type ServerSessionKeyInput = {
  requestId: string;
};

export function ttpPublicKeyResponse() {
  return {
    publicKeyPem: ca.publicKeyPem,
    certificatePem: ca.certificatePem,
  };
}

export function registerPrincipal(input: RegisterPrincipalInput) {
  const subjectId = rsa.privateKey(ca.privateKeyPem).decrypt(input.encryptedId);
  const issuedAt = new Date().toISOString();
  const principal = {
    role: input.role,
    subjectId,
    publicKeys: input.publicKeys,
  };
  const certificatePem = issueCertificate(principal);
  const record: PrincipalRecord = {
    ...principal,
    certificatePem,
    issuedAt,
  };

  principals.set(principalKey(input.role, subjectId), record);

  return {
    subjectId,
    certificatePem,
    issuedAt,
  };
}

export function authenticateServerCertificate(input: ServerAuthenticationInput) {
  const server = validateCertificate({
    role: "server",
    subjectId: input.serverId,
    certificatePem: input.certificatePem,
  });
  verifyPrincipalSignature(server, serverAuthenticationPayload(input), input.signature);
  const validatedAt = new Date().toISOString();

  pendingAuths.set(input.requestId, {
    requestId: input.requestId,
    serverId: input.serverId,
    expectedUserId: input.userId,
    validatedAt,
  });

  return {
    ok: true,
    requestId: input.requestId,
    serverId: input.serverId,
    validatedAt,
  } as const;
}

export function authenticateUserForServer(input: UserAuthenticationInput) {
  const request = decryptUserAuthenticationRequest(input.encryptedAuthMaterial);
  const pendingAuth = pendingAuths.get(request.requestId);

  if (!pendingAuth) {
    throw new Error(`authentication request ${request.requestId} was not initiated by server`);
  }

  if (pendingAuth.expectedUserId !== request.userId) {
    throw new Error("user authentication does not match the pending service request");
  }

  if (pendingAuth.serverId !== request.serverId) {
    throw new Error("server authentication does not match the pending service request");
  }

  const user = validateCertificate({
    role: "user",
    subjectId: request.userId,
    certificatePem: request.userCertificatePem,
  });
  const server = validateCertificate({
    role: "server",
    subjectId: request.serverId,
    certificatePem: request.serverCertificatePem,
  });
  verifyPrincipalSignature(user, userAuthenticationPayload(request), request.signature);
  const session = createSession(request.requestId, user.subjectId, server.subjectId);
  const ticketPayload = JSON.stringify({
    sessionId: session.sessionId,
    sessionKey: session.sessionKey,
  } satisfies SessionTicket);
  const encryptedSessionKeyForUser = rsa
    .publicKey(user.publicKeys.exchangePublicKeyPem)
    .encrypt(ticketPayload);
  const encryptedSessionKeyForServer = rsa
    .publicKey(server.publicKeys.exchangePublicKeyPem)
    .encrypt(ticketPayload);

  session.encryptedSessionKeyForUser = encryptedSessionKeyForUser;
  session.encryptedSessionKeyForServer = encryptedSessionKeyForServer;
  pendingAuths.delete(request.requestId);

  return {
    request,
    response: {
      ok: true as const,
      requestId: request.requestId,
    },
  };
}

export function serverSessionKey(input: ServerSessionKeyInput) {
  const session = [...sessions.values()].find((record) => record.requestId === input.requestId);

  if (!session) {
    throw new Error(`session for request ${input.requestId} not found`);
  }

  return {
    sessionId: session.sessionId,
    encryptedSessionKeyForUser: session.encryptedSessionKeyForUser,
    encryptedSessionKeyForServer: session.encryptedSessionKeyForServer,
  };
}

export function closeSession(sessionId: string) {
  const session = sessions.get(sessionId);

  if (!session) {
    throw new Error(`session ${sessionId} not found`);
  }

  session.closedAt = new Date().toISOString();
  return { ok: true, sessionId, closedAt: session.closedAt };
}

function decryptUserAuthenticationRequest(
  encryptedAuthMaterial: string,
): UserAuthenticationRequest {
  return JSON.parse(
    rsa.privateKey(ca.privateKeyPem).decrypt(encryptedAuthMaterial),
  ) as UserAuthenticationRequest;
}

function createSession(requestId: string, userId: string, serverId: string): SessionRecord {
  const session: SessionRecord = {
    sessionId: random.hex(16),
    requestId,
    userId,
    serverId,
    sessionKey: random.sessionKey(),
    encryptedSessionKeyForUser: "",
    encryptedSessionKeyForServer: "",
    createdAt: new Date().toISOString(),
  };

  sessions.set(session.sessionId, session);
  return session;
}

function verifyPrincipalSignature(principal: PrincipalRecord, payload: string, signature: string) {
  const verified = rsa.publicKey(principal.publicKeys.authPublicKeyPem).verify(payload, signature);

  if (!verified) {
    throw new Error(`${principal.role} authentication signature is invalid`);
  }
}

function serverAuthenticationPayload(input: {
  serverId: string;
  certificatePem: string;
  requestId: string;
  userId: string;
}) {
  return signedPayload.from({
    certificateHash: hash.of(input.certificatePem).sha256Hex(),
    requestId: input.requestId,
    role: "server",
    serverId: input.serverId,
    userId: input.userId,
  });
}

function userAuthenticationPayload(input: {
  userId: string;
  userCertificatePem: string;
  serverId: string;
  serverCertificatePem: string;
  requestId: string;
}) {
  return signedPayload.from({
    requestId: input.requestId,
    role: "user",
    serverCertificateHash: hash.of(input.serverCertificatePem).sha256Hex(),
    serverId: input.serverId,
    userCertificateHash: hash.of(input.userCertificatePem).sha256Hex(),
    userId: input.userId,
  });
}
