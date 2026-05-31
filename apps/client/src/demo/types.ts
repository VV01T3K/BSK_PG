import type { EncryptedEnvelope } from "server";
import type { EventLogEntry } from "ttp";
export type { EncryptedEnvelope, ServiceServerSnapshot } from "server";

export interface RsaKeyPair {
  publicKeyPem: string;
  privateKey: CryptoKey;
}

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

export interface SecurityDemoSnapshot {
  userRegistered: boolean;
  serverRegistered: boolean;
  sessionEstablished: boolean;
  userId?: string;
  serverId?: string;
  userCertificateFingerprint?: string;
  serverCertificateFingerprint?: string;
  sessionId?: string;
  sessionExpiresAt?: string;
  lastPlainRequest?: string;
  lastPlainResponse?: string;
  lastEncryptedRequest?: EncryptedEnvelope;
  lastEncryptedResponse?: EncryptedEnvelope;
  forgedCertificateRejected: boolean;
  forgedCertificateMessage?: string;
  mitmRejected: boolean;
  mitmMessage?: string;
  logs: EventLogEntry[];
}
