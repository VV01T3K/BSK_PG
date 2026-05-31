import type { SessionEncryptedPayload } from "@bsk/crypto";

export type { SessionEncryptedPayload };

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
  lastEncryptedRequest?: SessionEncryptedPayload;
  lastEncryptedResponse?: SessionEncryptedPayload;
}
