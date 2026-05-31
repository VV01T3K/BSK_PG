import type { RsaPair } from "@bsk/crypto";

export interface PrincipalState {
  id: string;
  exchangeKeyPair: RsaPair;
  certificatePem: string;
}

export interface ClientSessionState {
  sessionId: string;
  userSessionKey: string;
  expiresAt: string;
}
