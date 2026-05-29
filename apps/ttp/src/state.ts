import type { EventLogEntry, PrincipalRecord, Role, SessionRecord } from "./types.js";

export const principals = new Map<string, PrincipalRecord>();
export const sessions = new Map<string, SessionRecord>();
export const logs: EventLogEntry[] = [];

export function principalKey(role: Role, subjectId: string): string {
  return `${role}:${subjectId}`;
}

export function log(actor: EventLogEntry["actor"], event: string, details: string, level: EventLogEntry["level"] = "info") {
  logs.unshift({
    timestamp: new Date().toISOString(),
    actor,
    level,
    event,
    details,
  });
  logs.splice(80);
}

export function resetTtpStateForTests() {
  principals.clear();
  sessions.clear();
  logs.length = 0;
}
