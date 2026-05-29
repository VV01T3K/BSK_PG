import type { EventLogEntry } from "ttp";
import { fingerprint } from "./browser-crypto";
import type { ClientSessionState, PrincipalState, SecurityDemoSnapshot, ServiceServerSnapshot } from "./types";

export const logs: EventLogEntry[] = [];

export const state: {
  user?: PrincipalState;
  server?: ServiceServerSnapshot;
  session?: ClientSessionState;
  lastPlainRequest?: string;
  lastPlainResponse?: string;
  lastEncryptedRequest?: SecurityDemoSnapshot["lastEncryptedRequest"];
  lastEncryptedResponse?: SecurityDemoSnapshot["lastEncryptedResponse"];
  forgedCertificateRejected: boolean;
  forgedCertificateMessage?: string;
  mitmRejected: boolean;
  mitmMessage?: string;
} = {
  forgedCertificateRejected: false,
  mitmRejected: false,
};

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

export function clearClientState() {
  state.user = undefined;
  state.server = undefined;
  state.session = undefined;
  state.lastPlainRequest = undefined;
  state.lastPlainResponse = undefined;
  state.lastEncryptedRequest = undefined;
  state.lastEncryptedResponse = undefined;
  state.forgedCertificateRejected = false;
  state.forgedCertificateMessage = undefined;
  state.mitmRejected = false;
  state.mitmMessage = undefined;
  logs.length = 0;
}

function mergedLogs(): EventLogEntry[] {
  return [...logs, ...(state.server?.logs ?? [])]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 100);
}

export async function snapshot(): Promise<SecurityDemoSnapshot> {
  return {
    userRegistered: Boolean(state.user),
    serverRegistered: Boolean(state.server?.registered),
    sessionEstablished: Boolean(state.session && state.server?.sessionEstablished),
    userId: state.user?.id,
    serverId: state.server?.serverId,
    userCertificateFingerprint: state.user ? await fingerprint(state.user.certificatePem) : undefined,
    serverCertificateFingerprint: state.server?.certificateFingerprint,
    sessionId: state.session?.sessionId,
    sessionExpiresAt: state.session?.expiresAt ?? state.server?.sessionExpiresAt,
    lastPlainRequest: state.lastPlainRequest ?? state.server?.lastPlainRequest,
    lastPlainResponse: state.lastPlainResponse ?? state.server?.lastPlainResponse,
    lastEncryptedRequest: state.lastEncryptedRequest ?? state.server?.lastEncryptedRequest,
    lastEncryptedResponse: state.lastEncryptedResponse ?? state.server?.lastEncryptedResponse,
    forgedCertificateRejected: state.forgedCertificateRejected,
    forgedCertificateMessage: state.forgedCertificateMessage,
    mitmRejected: state.mitmRejected,
    mitmMessage: state.mitmMessage,
    logs: mergedLogs(),
  };
}

export function requireUser(): PrincipalState {
  if (!state.user) {
    throw new Error("user is not registered yet");
  }
  return state.user;
}

export function requireServer(): ServiceServerSnapshot & { serverId: string; certificatePem: string } {
  if (!state.server?.registered || !state.server.serverId || !state.server.certificatePem) {
    throw new Error("protected service server is not registered yet");
  }
  return state.server as ServiceServerSnapshot & { serverId: string; certificatePem: string };
}

export function requireSession(): ClientSessionState {
  if (!state.session) {
    throw new Error("session is not established yet");
  }
  if (Date.parse(state.session.expiresAt) <= Date.now()) {
    throw new Error("session has expired");
  }
  return state.session;
}
