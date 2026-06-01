import { createSecurityLogger } from "@bsk/rpc/log";

import type { PrincipalRecord, Role, SessionRecord } from "./types";

export const principals = new Map<string, PrincipalRecord>();
export const sessions = new Map<string, SessionRecord>();

const logger = createSecurityLogger(["application.log", "ttp.log"]);

export const log = logger.log;

export function principalKey(role: Role, subjectId: string): string {
  return `${role}:${subjectId}`;
}

export function resetTtpStateForTests() {
  principals.clear();
  sessions.clear();
  logger.reset();
}
