export type Role = "user" | "server";

export interface PrincipalRecord {
  role: Role;
  subjectId: string;
  publicKeys: {
    authPublicKeyPem: string;
    exchangePublicKeyPem: string;
  };
  certificatePem: string;
  issuedAt: string;
}

export interface SessionRecord {
  sessionId: string;
  requestId: string;
  userId: string;
  serverId: string;
  sessionKey: string;
  encryptedSessionKeyForUser: string;
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
