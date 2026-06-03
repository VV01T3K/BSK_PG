import {
  aesGcm,
  hash,
  random,
  rsa,
  type SessionEncryptedPayload,
  type SessionTicket,
} from "@bsk/crypto";
import { createRpcClient } from "@bsk/rpc/client";
import type { TtpRouter } from "ttp";
import { serverAuthenticationPayload } from "ttp/contract";

import {
  readServiceServerStatus,
  requireRegisteredServer,
  requireSessionKey,
  state,
} from "./state";

const ttpBaseUrl = process.env.TTP_API_BASE_URL ?? "http://localhost:3001";
const ttp = createRpcClient<TtpRouter>(ttpBaseUrl);

export async function registerProtectedServer() {
  const serverId = hash.of(`server-${random.uuid()}`).sha256Hex();
  const [ttpPublicKey, authKeyPair, exchangeKeyPair] = await Promise.all([
    ttp.publicKey(),
    rsa.generatePair(),
    rsa.generatePair(),
  ]);
  const registration = await ttp.register({
    role: "server",
    encryptedId: rsa.publicKey(ttpPublicKey.publicKeyPem).encrypt(serverId),
    publicKeys: {
      authPublicKeyPem: authKeyPair.publicKeyPem,
      exchangePublicKeyPem: exchangeKeyPair.publicKeyPem,
    },
  });

  state.serverId = registration.subjectId;
  state.authKeyPair = authKeyPair;
  state.exchangeKeyPair = exchangeKeyPair;
  state.certificatePem = registration.certificatePem;
  state.pendingRequests.clear();
  clearLocalSession();
  state.serviceExchanged = undefined;

  return readServiceServerStatus();
}

export async function requestService(input: { userId: string }) {
  requireRegisteredServer();
  const serverId = state.serverId!;
  const certificatePem = state.certificatePem!;
  const requestId = random.uuid();

  state.pendingRequests.set(requestId, {
    userId: input.userId,
    createdAt: new Date().toISOString(),
  });

  await ttp.auth.server({
    serverId,
    certificatePem,
    requestId,
    userId: input.userId,
    signature: rsa.privateKey(state.authKeyPair!.privateKeyPem).sign(
      serverAuthenticationPayload({
        serverId,
        certificatePem,
        requestId,
        userId: input.userId,
      }),
    ),
  });

  return {
    serverAuthenticated: true as const,
    requestId,
    ttpBaseUrl,
  };
}

export async function fetchServerSessionKey(input: { requestId: string }) {
  requireRegisteredServer();
  const pendingRequest = state.pendingRequests.get(input.requestId);

  if (!pendingRequest) {
    throw new Error(`service request ${input.requestId} not found`);
  }

  const response = await ttp.session.serverKey({ requestId: input.requestId });
  const ticket = decryptSessionTicket(response.encryptedSessionKeyForServer);

  if (ticket.sessionId !== response.sessionId) {
    throw new Error("session key payload does not match session id");
  }

  state.sessionId = ticket.sessionId;
  state.sessionKey = ticket.sessionKey;
  state.pendingRequests.delete(input.requestId);

  return readServiceServerStatus();
}

export function closeLocalSession() {
  const closedSession = state.sessionId;
  clearLocalSession();
  return { closedSession, serverStatus: readServiceServerStatus() };
}

export function exchangeProtectedServiceData(payload: SessionEncryptedPayload) {
  const sessionKey = requireSessionKey();
  const sessionCipher = aesGcm.withKey(sessionKey).forSession(state.sessionId!);
  const plaintext = sessionCipher.decrypt(payload);
  const responsePlaintext = `Protected service accepted encrypted request: ${plaintext}`;
  const encryptedResponse = sessionCipher.encrypt(responsePlaintext);

  state.serviceExchanged = true;

  return {
    payload: encryptedResponse,
  };
}

function decryptSessionTicket(encryptedTicket: string): SessionTicket {
  return JSON.parse(
    rsa.privateKey(state.exchangeKeyPair!.privateKeyPem).decrypt(encryptedTicket),
  ) as SessionTicket;
}

function clearLocalSession() {
  state.sessionId = undefined;
  state.sessionKey = undefined;
}
