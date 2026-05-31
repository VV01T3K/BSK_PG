import { random, rsa, type SessionTicket } from "@bsk/crypto";
import { issueCertificate, validateCertificate } from "./certificates";
import { ca } from "./crypto";
import { principalKey, principals, sessions } from "./state";
import type { PrincipalRecord, Role, SessionRecord } from "./types";

const SESSION_TTL_MS = 15 * 60 * 1000;

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
};

export type UserAuthenticationRequest = {
  userId: string;
  userCertificatePem: string;
  serverId: string;
  serverCertificatePem: string;
  requestId: string;
};

export type UserAuthenticationInput = {
  encryptedAuthMaterial: string;
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
  validateCertificate({
    role: "server",
    subjectId: input.serverId,
    certificatePem: input.certificatePem,
  });

  return {
    ok: true,
    requestId: input.requestId,
    serverId: input.serverId,
    validatedAt: new Date().toISOString(),
  } as const;
}

export function authenticateUserForServer(input: UserAuthenticationInput) {
  const request = decryptUserAuthenticationRequest(input.encryptedAuthMaterial);
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
  const session = createSession(user.subjectId, server.subjectId);
  const ticketPayload = JSON.stringify({
    sessionId: session.sessionId,
    sessionKey: session.sessionKey,
  } satisfies SessionTicket);

  return {
    request,
    response: {
      ok: true as const,
      sessionId: session.sessionId,
      encryptedSessionKeyForUser: rsa
        .publicKey(user.publicKeys.exchangePublicKeyPem)
        .encrypt(ticketPayload),
      encryptedSessionKeyForServer: rsa
        .publicKey(server.publicKeys.exchangePublicKeyPem)
        .encrypt(ticketPayload),
      expiresAt: session.expiresAt,
    },
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

function decryptUserAuthenticationRequest(encryptedAuthMaterial: string): UserAuthenticationRequest {
  return JSON.parse(
    rsa.privateKey(ca.privateKeyPem).decryptHybrid(encryptedAuthMaterial),
  ) as UserAuthenticationRequest;
}

function createSession(userId: string, serverId: string): SessionRecord {
  const session: SessionRecord = {
    sessionId: random.hex(16),
    userId,
    serverId,
    sessionKey: random.sessionKey(),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  };

  sessions.set(session.sessionId, session);
  return session;
}
