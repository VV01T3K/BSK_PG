import type { EncryptedEnvelope } from "@bsk/crypto";

export type { EncryptedEnvelope };

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
}
