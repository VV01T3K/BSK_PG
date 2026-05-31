import type { RsaPair } from "@bsk/crypto";

export type { EncryptedEnvelope, ServiceServerSnapshot } from "server";

export type RsaKeyPair = RsaPair;

export interface PrincipalState {
  id: string;
  exchangeKeyPair: RsaKeyPair;
  certificatePem: string;
  issuedAt: string;
}

export interface ClientSessionState {
  sessionId: string;
  userSessionKey: string;
  expiresAt: string;
}

export interface AttackResult {
  rejected: boolean;
  message: string;
}
