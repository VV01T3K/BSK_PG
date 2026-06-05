import {
  aesGcm,
  hash,
  random,
  rsa,
  type SessionEncryptedPayload,
  type SessionTicket,
} from "@bsk/crypto";
import { createRpcClient } from "@bsk/rpc/client";
import forge from "node-forge";
import type { TtpRouter } from "ttp";
import { serverAuthenticationPayload } from "ttp/contract";

import {
  artifact,
  readServiceServerStatus,
  requireRegisteredServer,
  requireSessionKey,
  state,
} from "./state";

const ttpBaseUrl = process.env.TTP_API_BASE_URL ?? "http://localhost:3001";
const ttp = createRpcClient<TtpRouter>(ttpBaseUrl);

type DemoFileServiceRequest =
  | {
      kind: "file.upload";
      name: string;
      mimeType: string;
      contentBase64: string;
    }
  | {
      kind: "file.view";
    };

type DemoFileResponse = {
  kind: "file.current";
  name: string;
  mimeType: string;
  size: number;
  contentBase64: string;
  storedAt: string;
};

type DemoFileEmptyResponse = {
  kind: "file.empty";
};

type DemoFileServiceResponse = DemoFileResponse | DemoFileEmptyResponse;

/**
 * Registers the protected Server with the TTP.
 * @returns Current Server status including its issued certificate.
 */
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
  state.lastServiceEvent = undefined;
  await Promise.all([
    artifact("server", `server/certificate-${state.serverId}.pem`, state.certificatePem),
    artifact("server", `server/certificate-${state.serverId}.json`, {
      artifact: "server-identity-certificate",
      serverId: state.serverId,
      certificate: forge.pki.certificateFromPem(state.certificatePem),
      certificatePem: state.certificatePem,
    }),
  ]);

  return readServiceServerStatus();
}

/**
 * Starts a protected service request by authenticating the Server to the TTP.
 * @param input User id requesting the service.
 * @returns Request id used for the following User-authentication step.
 */
export async function requestService(input: { userId: string }) {
  requireRegisteredServer();
  const serverId = state.serverId!;
  const certificatePem = state.certificatePem!;
  const requestId = random.uuid();

  state.pendingRequests.set(requestId, {
    userId: input.userId,
    createdAt: new Date().toISOString(),
  });

  const authenticationPayload = serverAuthenticationPayload({
    serverId,
    certificatePem,
    requestId,
    userId: input.userId,
  });
  const signature = rsa.privateKey(state.authKeyPair!.privateKeyPem).sign(authenticationPayload);
  await artifact("server", `server/authentication/${requestId}.json`, {
    requestId,
    serverId,
    userId: input.userId,
    authenticationPayload,
    signature,
  });

  await ttp.auth.server({
    serverId,
    certificatePem,
    requestId,
    userId: input.userId,
    signature,
  });

  return {
    serverAuthenticated: true as const,
    requestId,
    ttpBaseUrl,
  };
}

/**
 * Fetches and decrypts the Server session ticket.
 * @param input Service request id whose User authentication has completed.
 * @returns Updated Server status with an active session.
 */
export async function fetchServerSessionKey(input: { requestId: string }) {
  requireRegisteredServer();
  const pendingRequest = state.pendingRequests.get(input.requestId);

  if (!pendingRequest) {
    throw new Error(`service request ${input.requestId} not found`);
  }

  const response = await ttp.session.serverKey({ requestId: input.requestId });
  const ticket = JSON.parse(
    rsa
      .privateKey(state.exchangeKeyPair!.privateKeyPem)
      .decrypt(response.encryptedSessionKeyForServer),
  ) as SessionTicket;

  if (ticket.sessionId !== response.sessionId) {
    throw new Error("session key payload does not match session id");
  }

  state.sessionId = ticket.sessionId;
  state.sessionKey = ticket.sessionKey;
  state.serviceExchanged = undefined;
  state.pendingRequests.delete(input.requestId);

  return readServiceServerStatus();
}

/**
 * Clears the Server's local session state after service completion.
 * @returns Previous session id and updated Server status.
 */
export function closeLocalSession() {
  const closedSession = state.sessionId;
  clearLocalSession();
  return { closedSession, serverStatus: readServiceServerStatus() };
}

/**
 * Handles one encrypted protected-service request.
 * @param payload AES-GCM payload bound to the active session id.
 * @returns Encrypted service response using the same session key.
 */
export function exchangeProtectedServiceData(payload: SessionEncryptedPayload) {
  const sessionKey = requireSessionKey();
  const sessionCipher = aesGcm.withKey(sessionKey).forSession(state.sessionId!);
  const request = decodeFileServiceRequest(sessionCipher.decrypt(payload));
  const response = handleFileServiceRequest(request);
  const encryptedResponse = sessionCipher.encrypt(JSON.stringify(response));

  state.serviceExchanged = true;

  return {
    payload: encryptedResponse,
  };
}

function handleFileServiceRequest(request: DemoFileServiceRequest): DemoFileServiceResponse {
  if (request.kind === "file.upload") {
    const response = {
      kind: "file.current" as const,
      name: request.name,
      mimeType: request.mimeType,
      size: Buffer.from(request.contentBase64, "base64").byteLength,
      contentBase64: request.contentBase64,
      storedAt: new Date().toISOString(),
    };

    state.latestDemoFile = response;
    state.lastServiceEvent = {
      event: "demo file uploaded",
      details: `${response.name} (${response.size} bytes)`,
    };

    return response;
  }

  if (request.kind === "file.view") {
    state.lastServiceEvent = {
      event: "demo file viewed",
      details: state.latestDemoFile
        ? `${state.latestDemoFile.name} (${state.latestDemoFile.size} bytes)`
        : "no uploaded file",
    };
    return state.latestDemoFile
      ? {
          kind: "file.current",
          name: state.latestDemoFile.name,
          mimeType: state.latestDemoFile.mimeType,
          size: state.latestDemoFile.size,
          contentBase64: state.latestDemoFile.contentBase64,
          storedAt: state.latestDemoFile.storedAt,
        }
      : { kind: "file.empty" };
  }

  throw new Error("unsupported demo file service request");
}

function decodeFileServiceRequest(plaintext: string): DemoFileServiceRequest {
  const value = JSON.parse(plaintext) as {
    kind?: string;
    name?: string;
    mimeType?: string;
    contentBase64?: string;
  };

  if (value.kind === "file.view") {
    return { kind: value.kind };
  }

  if (value.kind !== "file.upload" || !value.name || !value.contentBase64) {
    throw new Error("invalid demo file service request");
  }

  return {
    kind: "file.upload",
    name: value.name,
    mimeType: value.mimeType ?? "application/octet-stream",
    contentBase64: value.contentBase64,
  };
}

function clearLocalSession() {
  state.sessionId = undefined;
  state.sessionKey = undefined;
}
