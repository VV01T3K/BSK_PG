import type { EventLogEntry } from "ttp";

export interface RsaPair {
  publicKeyPem: string;
  privateKeyPem: string;
}

export interface EncryptedEnvelope {
  sessionId: string;
  iv: string;
  ciphertext: string;
  authTag: string;
}

export interface ServiceServerState {
  serverId?: string;
  rawIdSeed?: string;
  authKeyPair?: RsaPair;
  exchangeKeyPair?: RsaPair;
  certificatePem?: string;
  issuedAt?: string;
  sessionId?: string;
  sessionKey?: string;
  sessionExpiresAt?: string;
  lastPlainRequest?: string;
  lastPlainResponse?: string;
  lastEncryptedRequest?: EncryptedEnvelope;
  lastEncryptedResponse?: EncryptedEnvelope;
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
