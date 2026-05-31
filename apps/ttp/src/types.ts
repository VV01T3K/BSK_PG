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
  userId: string;
  serverId: string;
  sessionKey: string;
  createdAt: string;
  expiresAt: string;
  closedAt?: string;
}
