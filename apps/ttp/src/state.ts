import { createCertificateAuthority } from "@bsk/crypto";
import { createSecurityLogger } from "@bsk/rpc/log";

import type { Role } from "./contract";
import type { PendingAuthRecord, PrincipalRecord, SessionRecord } from "./types";

export const ca = createCertificateAuthority({
  commonName: "BSK PG Trusted Third Party",
  organization: "BSK PG Demo",
});

export const principals = new Map<string, PrincipalRecord>();
export const sessions = new Map<string, SessionRecord>();
export const sessionsByRequest = new Map<string, string>();
export const pendingAuths = new Map<string, PendingAuthRecord>();

const logger = createSecurityLogger(["application.log", "ttp.log"]);

export const log = logger.log;

export function principalKey(role: Role, subjectId: string): string {
  return `${role}:${subjectId}`;
}
