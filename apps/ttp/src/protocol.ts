import { issuePrincipalCertificate, random, rsa, type SessionTicket } from "@bsk/crypto";

import {
  serverAuthenticationPayload,
  userAuthenticationPayload,
  type RegisterPrincipalInput,
  type ServerAuthenticationInput,
  type ServerSessionKeyInput,
  type UserAuthenticationInput,
  type UserAuthenticationRequest,
  type UserAuthRedirectInput,
} from "./contract";
import { ca, pendingAuths, principalKey, principals, sessions, sessionsByRequest } from "./state";
import type { PrincipalRecord, SessionRecord } from "./state";

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

/**
 * The TTP's "request for User authentication" (Fig. 2: "User Auth. redirect").
 * After the server has been validated, the User asks the TTP to confirm it should
 * authenticate. The TTP replies that the server was authenticated and that the User
 * may now submit its authentication data for this request.
 */
export function requestUserAuthentication(input: UserAuthRedirectInput) {
  const pendingAuth = pendingAuths.get(input.requestId);

  if (!pendingAuth) {
    throw new Error(`no validated server authentication for request ${input.requestId}`);
  }

  return {
    requestId: pendingAuth.requestId,
    serverId: pendingAuth.serverId,
    serverAuthenticated: true as const,
    action: "submit-user-authentication" as const,
  };
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

  session.encryptedSessionKeyForServer = encryptedSessionKeyForServer;
  pendingAuths.delete(request.requestId);

  return {
    request,
    response: {
      ok: true as const,
      sessionId: session.sessionId,
      encryptedSessionKeyForUser,
    },
  };
}

export function serverSessionKey(input: ServerSessionKeyInput) {
  const sessionId = sessionsByRequest.get(input.requestId);
  const session = sessionId ? sessions.get(sessionId) : undefined;

  if (!session) {
    throw new Error(`session for request ${input.requestId} not found`);
  }

  if (session.closedAt) {
    throw new Error(`session for request ${input.requestId} is closed`);
  }

  return {
    sessionId: session.sessionId,
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
    encryptedSessionKeyForServer: "",
    createdAt: new Date().toISOString(),
  };

  sessions.set(session.sessionId, session);
  sessionsByRequest.set(requestId, session.sessionId);
  return session;
}

function verifyPrincipalSignature(principal: PrincipalRecord, payload: string, signature: string) {
  const verified = rsa.publicKey(principal.publicKeys.authPublicKeyPem).verify(payload, signature);

  if (!verified) {
    throw new Error(`${principal.role} authentication signature is invalid`);
  }
}

type CertifiablePrincipal = Pick<PrincipalRecord, "role" | "subjectId" | "publicKeys">;

type CertificateClaim = Pick<PrincipalRecord, "role" | "subjectId"> & {
  certificatePem: string;
};

const compactPem = (pem: string) => pem.replace(/\s+/g, "");

function issueCertificate(principal: CertifiablePrincipal): string {
  return issuePrincipalCertificate({
    authority: ca,
    role: principal.role,
    subjectId: principal.subjectId,
    publicKeyPem: principal.publicKeys.exchangePublicKeyPem,
  });
}

function validateCertificate(claim: CertificateClaim): PrincipalRecord {
  const record = principals.get(principalKey(claim.role, claim.subjectId));

  if (!record || compactPem(record.certificatePem) !== compactPem(claim.certificatePem)) {
    throw new Error(`${claim.role} certificate does not match the one issued by TTP`);
  }

  return record;
}
