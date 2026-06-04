import { createCertificateAuthority } from "@bsk/crypto";
import { createSecurityLogger } from "@bsk/rpc/log";

import type { IdentityPublicKeys, Role } from "./contract";

export interface IdentityRecord {
  role: Role;
  subjectId: string;
  publicKeys: IdentityPublicKeys;
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

export const ca = await createCertificateAuthority({
  commonName: "BSK PG Trusted Third Party",
  organization: "BSK PG Demo",
});

export const registeredIdentities = new Map<string, IdentityRecord>();
export const sessions = new Map<string, SessionRecord>();
export const sessionsByRequest = new Map<string, string>();
export const pendingAuths = new Map<string, PendingAuthRecord>();

const logger = createSecurityLogger(["application.log", "ttp.log"]);

export const log = logger.log;

export function identityKey(role: Role, subjectId: string): string {
  return `${role}:${subjectId}`;
}
