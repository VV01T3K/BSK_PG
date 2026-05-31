import { fingerprint } from "./browser-crypto";
import type { ClientSessionState, PrincipalState, SecurityDemoSnapshot, ServiceServerSnapshot } from "./types";

export const state: {
  user?: PrincipalState;
  session?: ClientSessionState;
} = {};

export function clearClientState() {
  state.user = undefined;
  state.session = undefined;
}

export async function snapshot(server: ServiceServerSnapshot | undefined): Promise<SecurityDemoSnapshot> {
  return {
    userRegistered: Boolean(state.user),
    serverRegistered: Boolean(server?.registered),
    sessionEstablished: Boolean(state.session && server?.sessionEstablished),
    userId: state.user?.id,
    serverId: server?.serverId,
    userCertificateFingerprint: state.user ? await fingerprint(state.user.certificatePem) : undefined,
    serverCertificateFingerprint: server?.certificateFingerprint,
    sessionId: state.session?.sessionId,
    sessionExpiresAt: state.session?.expiresAt ?? server?.sessionExpiresAt,
    lastPlainRequest: server?.lastPlainRequest,
    lastPlainResponse: server?.lastPlainResponse,
    lastEncryptedRequest: server?.lastEncryptedRequest,
    lastEncryptedResponse: server?.lastEncryptedResponse,
  };
}

export function requireUser(): PrincipalState {
  if (!state.user) {
    throw new Error("user is not registered yet");
  }
  return state.user;
}

export function requireSession(): ClientSessionState {
  if (!state.session) {
    throw new Error("session is not established yet");
  }
  return state.session;
}
