import type { SessionEncryptedPayload } from "@bsk/crypto";

export type { SessionEncryptedPayload };

export interface ServiceServerStatus {
  registered: boolean;
  serverId?: string;
  certificatePem?: string;
  sessionEstablished: boolean;
  serviceExchanged: boolean;
}
