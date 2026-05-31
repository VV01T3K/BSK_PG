import { fingerprint } from "./browser-crypto";
import type { ClientSessionState, PrincipalState } from "./types";

/** Browser-held secrets only — never rendered, derived public fields are exposed via clientIdentity(). */
export const state: {
  user?: PrincipalState;
  session?: ClientSessionState;
} = {};

export function clearClientState() {
  state.user = undefined;
  state.session = undefined;
}

/** The browser-held side of the demo, derived from local secrets only (no server data). */
export async function clientIdentity() {
  return {
    userRegistered: Boolean(state.user),
    userId: state.user?.id,
    userCertificateFingerprint: state.user ? await fingerprint(state.user.certificatePem) : undefined,
    sessionId: state.session?.sessionId,
    sessionExpiresAt: state.session?.expiresAt,
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
