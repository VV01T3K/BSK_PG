import { createFileLogger, type EventLogEntry } from "@bsk/rpc/log";
import { hash, type RsaPair } from "@bsk/crypto";
import type { SessionEncryptedPayload, ServiceServerSnapshot } from "./types";

type ServiceServerState = {
  serverId?: string;
  exchangeKeyPair?: RsaPair;
  certificatePem?: string;
  issuedAt?: string;
  sessionId?: string;
  sessionKey?: string;
  sessionExpiresAt?: string;
  lastPlainRequest?: string;
  lastPlainResponse?: string;
  lastEncryptedRequest?: SessionEncryptedPayload;
  lastEncryptedResponse?: SessionEncryptedPayload;
};

export const state: ServiceServerState = {};

const logger = createFileLogger("server.log");

export const readLogs = logger.readLogs;

export function log(event: string, details: string, level: EventLogEntry["level"] = "info") {
  logger.log("server", event, details, level);
}

export function resetServiceServerStateForTests() {
  for (const key of Object.keys(state) as Array<keyof ServiceServerState>) {
    delete state[key];
  }
  logger.reset();
}

export function snapshot(): ServiceServerSnapshot {
  return {
    registered: Boolean(state.serverId),
    serverId: state.serverId,
    certificatePem: state.certificatePem,
    certificateFingerprint: state.certificatePem ? hash.of(state.certificatePem).fingerprint() : undefined,
    issuedAt: state.issuedAt,
    sessionEstablished: Boolean(state.sessionId),
    sessionId: state.sessionId,
    sessionExpiresAt: state.sessionExpiresAt,
    lastPlainRequest: state.lastPlainRequest,
    lastPlainResponse: state.lastPlainResponse,
    lastEncryptedRequest: state.lastEncryptedRequest,
    lastEncryptedResponse: state.lastEncryptedResponse,
  };
}

export function requireRegisteredServer() {
  if (!state.serverId || !state.certificatePem || !state.exchangeKeyPair) {
    throw new Error("service server is not registered with TTP");
  }
}

export function requireSessionKey(): string {
  if (!state.sessionId || !state.sessionKey) {
    throw new Error("service server has no accepted session key");
  }
  return state.sessionKey;
}
