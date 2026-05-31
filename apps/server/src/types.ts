import type { EventLogEntry } from "ttp";

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
