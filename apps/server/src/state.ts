import { createFileLogger, type EventLogEntry } from "@bsk/rpc/log";
import { type RsaPair } from "@bsk/crypto";
import type { ServiceServerStatus } from "./types";

type ServiceServerState = {
  serverId?: string;
  exchangeKeyPair?: RsaPair;
  certificatePem?: string;
  sessionId?: string;
  sessionKey?: string;
  serviceExchanged?: boolean;
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

export function readServiceServerStatus(): ServiceServerStatus {
  return {
    registered: Boolean(state.serverId),
    serverId: state.serverId,
    certificatePem: state.certificatePem,
    sessionEstablished: Boolean(state.sessionId),
    serviceExchanged: Boolean(state.serviceExchanged),
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
