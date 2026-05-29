import type { EventLogEntry } from "ttp";
import { fingerprint } from "./crypto.js";
import type { ServiceServerSnapshot, ServiceServerState } from "./types.js";

export const state: ServiceServerState = {};
export const logs: EventLogEntry[] = [];

export function log(event: string, details: string, level: EventLogEntry["level"] = "info") {
  logs.unshift({
    timestamp: new Date().toISOString(),
    actor: "server",
    level,
    event,
    details,
  });
  logs.splice(80);
}

export function resetServiceServerStateForTests() {
  for (const key of Object.keys(state) as Array<keyof ServiceServerState>) {
    delete state[key];
  }
  logs.length = 0;
}

export function snapshot(): ServiceServerSnapshot {
  return {
    registered: Boolean(state.serverId),
    serverId: state.serverId,
    certificatePem: state.certificatePem,
    certificateFingerprint: state.certificatePem ? fingerprint(state.certificatePem) : undefined,
    issuedAt: state.issuedAt,
    sessionEstablished: Boolean(state.sessionId),
    sessionId: state.sessionId,
    sessionExpiresAt: state.sessionExpiresAt,
    lastPlainRequest: state.lastPlainRequest,
    lastPlainResponse: state.lastPlainResponse,
    lastEncryptedRequest: state.lastEncryptedRequest,
    lastEncryptedResponse: state.lastEncryptedResponse,
    logs,
  };
}

export function requireRegisteredServer() {
  if (!state.serverId || !state.certificatePem || !state.exchangeKeyPair) {
    throw new Error("service server is not registered with TTP");
  }
}

function assertSessionNotExpired() {
  if (state.sessionExpiresAt && Date.parse(state.sessionExpiresAt) <= Date.now()) {
    throw new Error("session has expired");
  }
}

export function requireSessionKey(): string {
  if (!state.sessionId || !state.sessionKey) {
    throw new Error("service server has no accepted session key");
  }
  assertSessionNotExpired();
  return state.sessionKey;
}
