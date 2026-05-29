import type { EventLogEntry } from "ttp";

export interface RsaKeyPair {
  publicKeyPem: string;
  privateKey: CryptoKey;
}

export interface PrincipalState {
  id: string;
  rawIdSeed: string;
  authKeyPair: RsaKeyPair;
  exchangeKeyPair: RsaKeyPair;
  certificatePem: string;
  issuedAt: string;
}

export interface EncryptedEnvelope {
  sessionId: string;
  iv: string;
  ciphertext: string;
  authTag: string;
}

export interface ServiceServerSnapshot {
  registered: boolean;
  serverId?: string;
  certificatePem?: string;
  certificateFingerprint?: string;
  issuedAt?: string;
  sessionEstablished: boolean;
  sessionId?: string;
  sessionExpiresAt?: string;
  lastPlainRequest?: string;
  lastPlainResponse?: string;
  lastEncryptedRequest?: EncryptedEnvelope;
  lastEncryptedResponse?: EncryptedEnvelope;
  logs: EventLogEntry[];
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
