import { type RsaPair } from "@bsk/crypto";
import { createSecurityLogger, type SecurityLogLevel } from "@bsk/rpc/log";

type ServiceServerState = {
  serverId?: string;
  authKeyPair?: RsaPair;
  exchangeKeyPair?: RsaPair;
  certificatePem?: string;
  sessionId?: string;
  sessionKey?: string;
  serviceExchanged?: boolean;
  pendingRequests: Map<string, { userId: string; createdAt: string }>;
};

export interface ServiceServerStatus {
  registered: boolean;
  serverId?: string;
  certificatePem?: string;
  sessionEstablished: boolean;
  serviceExchanged: boolean;
}

export const state: ServiceServerState = {
  pendingRequests: new Map(),
};

const logger = createSecurityLogger(["application.log", "server.log"]);

export function log(event: string, details: string, level: SecurityLogLevel = "info") {
  logger.log("server", event, details, level);
}

export function resetServiceServerState() {
  state.pendingRequests.clear();
  for (const key of Object.keys(state) as Array<keyof ServiceServerState>) {
    if (key === "pendingRequests") continue;
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
  if (!state.serverId || !state.certificatePem || !state.authKeyPair || !state.exchangeKeyPair) {
    throw new Error("service server is not registered with TTP");
  }
}

export function requireSessionKey(): string {
  if (!state.sessionId || !state.sessionKey) {
    throw new Error("service server has no accepted session key");
  }
  return state.sessionKey;
}
