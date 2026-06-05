import {
  issueIdentityCertificate,
  random,
  rsa,
  verifyCertificateSignedBy,
  type SessionTicket,
} from "@bsk/crypto";
import forge from "node-forge";

import {
  serverAuthenticationPayload,
  userAuthenticationPayload,
  type RegisterIdentityInput,
  type ServerAuthenticationInput,
  type ServerSessionKeyInput,
  type UserAuthenticationInput,
  type UserAuthenticationRequest,
  type UserAuthRedirectInput,
} from "./contract";
import {
  artifact,
  ca,
  pendingAuths,
  identityKey,
  registeredIdentities,
  sessions,
  sessionsByRequest,
} from "./state";
import type { IdentityRecord, SessionRecord } from "./state";

let authorityArtifactsSaved = false;

export async function ttpPublicKeyResponse() {
  if (!authorityArtifactsSaved) {
    authorityArtifactsSaved = true;
    await Promise.all([
      artifact("ttp", "ttp/authority.pem", ca.certificatePem),
      artifact("ttp", "ttp/authority.json", {
        artifact: "ttp-authority-certificate",
        certificate: forge.pki.certificateFromPem(ca.certificatePem),
        certificatePem: ca.certificatePem,
        publicKeyPem: ca.publicKeyPem,
      }),
    ]);
  }

  return {
    publicKeyPem: ca.publicKeyPem,
    certificatePem: ca.certificatePem,
  };
}

/**
 * Registers a User or Server and issues its identity certificate.
 * @param input Encrypted subject id, role and public keys submitted by the identity.
 * @returns Registered subject id, certificate and issuance timestamp.
 */
export async function registerIdentity(input: RegisterIdentityInput) {
  const subjectId = rsa.privateKey(ca.privateKeyPem).decrypt(input.encryptedId);
  const issuedAt = new Date().toISOString();
  const identity = {
    role: input.role,
    subjectId,
    publicKeys: input.publicKeys,
  };
  const certificatePem = issueIdentityCertificate({
    authority: ca,
    role: identity.role,
    subjectId: identity.subjectId,
    publicKeyPem: identity.publicKeys.exchangePublicKeyPem,
  });
  const record: IdentityRecord = {
    ...identity,
    certificatePem,
    issuedAt,
  };

  registeredIdentities.set(identityKey(input.role, subjectId), record);
  await Promise.all([
    artifact("ttp", `ttp/certificates/${input.role}-${subjectId}.pem`, certificatePem),
    artifact("ttp", `ttp/certificates/${input.role}-${subjectId}.json`, {
      artifact: "ttp-issued-identity-certificate",
      role: input.role,
      subjectId,
      issuedAt,
      certificate: forge.pki.certificateFromPem(certificatePem),
      certificatePem,
      publicKeys: input.publicKeys,
    }),
  ]);

  return {
    subjectId,
    certificatePem,
    issuedAt,
  };
}

/**
 * Validates Server authentication and creates a pending User-auth request.
 * @param input Server certificate, request id, User id and Server signature.
 * @returns Server-authentication confirmation for the request.
 */
export function authenticateServerCertificate(input: ServerAuthenticationInput) {
  const server = validateCertificate({
    role: "server",
    subjectId: input.serverId,
    certificatePem: input.certificatePem,
  });
  verifyIdentitySignature(server, serverAuthenticationPayload(input), input.signature);
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
 * Returns the User-authentication redirect after Server validation.
 * @param input Service request id.
 * @returns Redirect metadata telling the Client to submit User authentication.
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

/**
 * Validates User authentication and issues encrypted session tickets.
 * @param input User authentication material encrypted to the TTP.
 * @returns The validated request and encrypted User session ticket.
 */
export async function authenticateUserForServer(input: UserAuthenticationInput) {
  const request = JSON.parse(
    rsa.privateKey(ca.privateKeyPem).decrypt(input.encryptedAuthMaterial),
  ) as UserAuthenticationRequest;
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
  verifyIdentitySignature(user, userAuthenticationPayload(request), request.signature);
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
  await artifact("ttp", `ttp/session-tickets/${request.requestId}-${session.sessionId}.json`, {
    requestId: request.requestId,
    sessionId: session.sessionId,
    issuedAt: new Date().toISOString(),
    encryptedSessionKeyForUser,
    encryptedSessionKeyForServer,
  });

  return {
    request,
    response: {
      ok: true as const,
      sessionId: session.sessionId,
      encryptedSessionKeyForUser,
    },
  };
}

/**
 * Returns the Server copy of the encrypted session ticket.
 * @param input Completed service request id.
 * @returns Session id and ticket encrypted with the Server exchange key.
 */
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

/**
 * Marks a negotiated session as closed in the TTP state.
 * @param sessionId Session identifier to close.
 * @returns Close confirmation with timestamp.
 */
export function closeSession(sessionId: string) {
  const session = sessions.get(sessionId);

  if (!session) {
    throw new Error(`session ${sessionId} not found`);
  }

  session.closedAt = new Date().toISOString();
  return { ok: true, sessionId, closedAt: session.closedAt };
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

function verifyIdentitySignature(identity: IdentityRecord, payload: string, signature: string) {
  const verified = rsa.publicKey(identity.publicKeys.authPublicKeyPem).verify(payload, signature);

  if (!verified) {
    throw new Error(`${identity.role} authentication signature is invalid`);
  }
}

type CertificateClaim = Pick<IdentityRecord, "role" | "subjectId"> & {
  certificatePem: string;
};

function validateCertificate(claim: CertificateClaim): IdentityRecord {
  const { commonName } = verifyCertificateSignedBy(ca, claim.certificatePem);
  const expectedCommonName = identityKey(claim.role, claim.subjectId);

  if (commonName !== expectedCommonName) {
    throw new Error(
      `${claim.role} certificate subject "${commonName}" does not match the claimed identity`,
    );
  }

  const record = registeredIdentities.get(expectedCommonName);

  if (!record) {
    throw new Error(`${claim.role} ${claim.subjectId} is not registered with TTP`);
  }

  return record;
}
