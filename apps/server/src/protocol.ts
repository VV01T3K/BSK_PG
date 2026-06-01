import { aesGcm, hash, random, rsa, signedPayload, type SessionTicket } from "@bsk/crypto";
import { createRpcClient } from "@bsk/rpc/client";
import { readServiceServerStatus, requireRegisteredServer, requireSessionKey, state } from "./state";
import type { SessionEncryptedPayload } from "./types";
import type { TtpRouter } from "ttp";

const ttp = createRpcClient<TtpRouter>(process.env.TTP_API_BASE_URL ?? "http://localhost:3001");

export type AcceptSessionInput = {
  sessionId: string;
  encryptedSessionKeyForServer: string;
};

export async function registerProtectedServer() {
  const ttpPublicKeyPem = (await ttp.publicKey()).publicKeyPem;
  const serverId = hash.of(`server-${random.uuid()}`).sha256Hex();
  const authKeyPair = rsa.generatePair();
  const exchangeKeyPair = rsa.generatePair();
  const registration = await ttp.register({
    role: "server",
    encryptedId: rsa.publicKey(ttpPublicKeyPem).encrypt(serverId),
    publicKeys: {
      authPublicKeyPem: authKeyPair.publicKeyPem,
      exchangePublicKeyPem: exchangeKeyPair.publicKeyPem,
    },
  });

  state.serverId = registration.subjectId;
  state.authKeyPair = authKeyPair;
  state.exchangeKeyPair = exchangeKeyPair;
  state.certificatePem = registration.certificatePem;
  clearLocalSession();
  state.serviceExchanged = undefined;

  return readServiceServerStatus();
}

export async function authenticateProtectedServer(requestId: string = random.uuid()) {
  requireRegisteredServer();
  const serverId = state.serverId!;
  const certificatePem = state.certificatePem!;
  const response = await ttp.auth.server({
    serverId,
    certificatePem,
    requestId,
    signature: rsa.privateKey(state.authKeyPair!.privateKeyPem).sign(
      serverAuthenticationPayload({ serverId, certificatePem, requestId }),
    ),
  });

  return { ...response, certificatePem };
}

export function acceptSessionTicket(input: AcceptSessionInput) {
  requireRegisteredServer();
  const ticket = decryptSessionTicket(input.encryptedSessionKeyForServer);

  if (ticket.sessionId !== input.sessionId) {
    throw new Error("session key payload does not match session id");
  }

  state.sessionId = ticket.sessionId;
  state.sessionKey = ticket.sessionKey;

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

function serverAuthenticationPayload(input: { serverId: string; certificatePem: string; requestId: string }) {
  return signedPayload.from({
    certificateHash: hash.of(input.certificatePem).sha256Hex(),
    requestId: input.requestId,
    role: "server",
    serverId: input.serverId,
  });
}
