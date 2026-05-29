export type Role = "user" | "server";

export interface EventLogEntry {
  timestamp: string;
  actor: "ttp" | "user" | "server";
  level: "info" | "warn" | "error";
  event: string;
  details: string;
}

export interface PublicKeySet {
  authPublicKeyPem: string;
  exchangePublicKeyPem: string;
}

export interface RegisterRequest {
  role: Role;
  encryptedId: string;
  publicKeys: PublicKeySet;
}

export interface RegisterResponse {
  certificatePem: string;
  subjectId: string;
  issuedAt: string;
}

export interface ServerAuthRequest {
  serverId: string;
  certificatePem: string;
  requestId: string;
}

export interface ServerAuthResponse {
  ok: true;
  requestId: string;
  serverId: string;
  validatedAt: string;
}

export interface UserAuthMaterial {
  userId: string;
  userCertificatePem: string;
  serverId: string;
  serverCertificatePem: string;
  requestId: string;
}

export interface UserAuthRequest {
  encryptedAuthMaterial: string;
}

export interface HybridEncryptedEnvelope {
  encryptedKey: string;
  iv: string;
  ciphertext: string;
  authTag: string;
}

export interface UserAuthResponse {
  ok: true;
  sessionId: string;
  encryptedSessionKeyForUser: string;
  encryptedSessionKeyForServer: string;
  expiresAt: string;
}

export interface SessionCloseRequest {
  sessionId: string;
}

export interface PrincipalRecord {
  role: Role;
  subjectId: string;
  publicKeys: PublicKeySet;
  certificatePem: string;
  issuedAt: string;
}

export interface SessionRecord {
  sessionId: string;
  userId: string;
  serverId: string;
  sessionKey: string;
  createdAt: string;
  expiresAt: string;
  closedAt?: string;
}
