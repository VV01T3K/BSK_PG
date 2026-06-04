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

type UploadFileRequest = {
  kind: "file.upload";
  name: string;
  mimeType: string;
  contentBase64: string;
};

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
  state.serviceExchanged = undefined;
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
    return uploadFile(request);
  }

  if (request.kind === "file.view") {
    state.lastServiceEvent = {
      event: "demo file viewed",
      details: state.latestDemoFile
        ? `${state.latestDemoFile.name} (${state.latestDemoFile.size} bytes)`
        : "no uploaded file",
    };
    return state.latestDemoFile
      ? currentFileResponse(state.latestDemoFile)
      : { kind: "file.empty" };
  }

  throw new Error("unsupported demo file service request");
}

function uploadFile(request: UploadFileRequest): DemoFileResponse {
  const storedAt = new Date().toISOString();
  const size = Buffer.from(request.contentBase64, "base64").byteLength;
  const response: DemoFileResponse = {
    kind: "file.current",
    name: request.name,
    mimeType: request.mimeType,
    size,
    contentBase64: request.contentBase64,
    storedAt,
  };

  state.latestDemoFile = response;
  state.lastServiceEvent = {
    event: "demo file uploaded",
    details: `${response.name} (${response.size} bytes)`,
  };

  return response;
}

function currentFileResponse(file: {
  name: string;
  mimeType: string;
  size: number;
  contentBase64: string;
  storedAt: string;
}): DemoFileResponse {
  return {
    kind: "file.current",
    name: file.name,
    mimeType: file.mimeType,
    size: file.size,
    contentBase64: file.contentBase64,
    storedAt: file.storedAt,
  };
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

function decryptSessionTicket(encryptedTicket: string): SessionTicket {
  return JSON.parse(
    rsa.privateKey(state.exchangeKeyPair!.privateKeyPem).decrypt(encryptedTicket),
  ) as SessionTicket;
}

function clearLocalSession() {
  state.sessionId = undefined;
  state.sessionKey = undefined;
}
