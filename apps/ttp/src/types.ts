import type { PrincipalPublicKeys, Role } from "./contract";

export interface PrincipalRecord {
  role: Role;
  subjectId: string;
  publicKeys: PrincipalPublicKeys;
  certificatePem: string;
  issuedAt: string;
}

export interface SessionRecord {
  sessionId: string;
  requestId: string;
  userId: string;
  serverId: string;
  sessionKey: string;
  encryptedSessionKeyForServer: string;
  createdAt: string;
  closedAt?: string;
}

export interface PendingAuthRecord {
  requestId: string;
  serverId: string;
  expectedUserId: string;
  validatedAt: string;
}
