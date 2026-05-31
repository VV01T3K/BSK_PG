import { service, ttp } from "#/api";
import {
  decryptAesGcm,
  decryptRsaOaepBase64,
  encryptAesGcm,
  encryptLargePayloadForTtp,
  encryptRsaOaepBase64,
  fingerprint,
  generateRsaKeyPair,
  randomIdSeed,
  sha256Hex,
} from "./browser-crypto";
import { clearClientState, log, requireServer, requireSession, requireUser, snapshot, state } from "./state";
import type { EncryptedEnvelope, PrincipalState, SecurityDemoSnapshot, ServiceServerSnapshot } from "./types";

async function getTtpPublicKey(): Promise<string> {
  const payload = await ttp.publicKey();
  return payload.publicKeyPem;
}

async function registerUser(): Promise<PrincipalState> {
  const id = await sha256Hex(randomIdSeed("user"));
  const ttpPublicKeyPem = await getTtpPublicKey();
  const authKeyPair = await generateRsaKeyPair();
  const exchangeKeyPair = await generateRsaKeyPair();
  const registration = await ttp.register({
    role: "user",
    encryptedId: await encryptRsaOaepBase64(ttpPublicKeyPem, id),
    publicKeys: {
      authPublicKeyPem: authKeyPair.publicKeyPem,
      exchangePublicKeyPem: exchangeKeyPair.publicKeyPem,
    },
  });
  log("user", "registered with TTP", `certificate ${await fingerprint(registration.certificatePem)}`);
  return {
    id: registration.subjectId,
    exchangeKeyPair,
    certificatePem: registration.certificatePem,
    issuedAt: registration.issuedAt,
  };
}

async function refreshServerState(): Promise<ServiceServerSnapshot> {
  state.server = await service.state();
  return state.server;
}

async function decryptSessionKey(user: PrincipalState, encryptedSessionKey: string): Promise<{ sessionId: string; sessionKey: string }> {
  return JSON.parse(await decryptRsaOaepBase64(user.exchangeKeyPair.privateKey, encryptedSessionKey)) as {
    sessionId: string;
    sessionKey: string;
  };
}

export async function getSecurityDemoState(): Promise<SecurityDemoSnapshot> {
  await refreshServerState().catch(() => undefined);
  return snapshot();
}

export async function resetSecurityDemo(): Promise<SecurityDemoSnapshot> {
  clearClientState();
  await service.reset();
  log("user", "demo reset", "cleared browser Client state and protected Server state");
  await refreshServerState();
  return snapshot();
}

export async function registerSecurityDemoRoles(): Promise<SecurityDemoSnapshot> {
  state.user = await registerUser();
  state.server = await service.server.register();
  state.session = undefined;
  state.forgedCertificateRejected = false;
  state.forgedCertificateMessage = undefined;
  state.mitmRejected = false;
  state.mitmMessage = undefined;
  log("server", "service server registered", `server ${state.server.serverId?.slice(0, 12)}`);
  return snapshot();
}

export async function authenticateSecurityDemoSession(): Promise<SecurityDemoSnapshot> {
  const user = requireUser();
  const server = requireServer();
  const requestId = crypto.randomUUID();

  await service.server.authenticate({ requestId });
  log("server", "server authenticated", `request ${requestId}`);

  const ttpPublicKeyPem = await getTtpPublicKey();
  const authMaterial = {
    userId: user.id,
    userCertificatePem: user.certificatePem,
    serverId: server.serverId,
    serverCertificatePem: server.certificatePem,
    requestId,
  };
  const userAuth = await ttp.auth.user({
    encryptedAuthMaterial: await encryptLargePayloadForTtp(ttpPublicKeyPem, JSON.stringify(authMaterial)),
  });

  const userSession = await decryptSessionKey(user, userAuth.encryptedSessionKeyForUser);
  if (userSession.sessionId !== userAuth.sessionId) {
    throw new Error("TTP returned inconsistent session identifiers");
  }

  await service.server.acceptSession({
    sessionId: userAuth.sessionId,
    encryptedSessionKeyForServer: userAuth.encryptedSessionKeyForServer,
    expiresAt: userAuth.expiresAt,
  });

  state.session = {
    sessionId: userAuth.sessionId,
    userSessionKey: userSession.sessionKey,
    expiresAt: userAuth.expiresAt,
  };
  await refreshServerState();
  log("ttp", "session accepted", `AES-256 key distributed to User and Server for ${userAuth.sessionId}`);
  return snapshot();
}

export async function exchangeEncryptedServiceMessage(): Promise<SecurityDemoSnapshot> {
  const session = requireSession();
  const user = requireUser();
  const requestPlaintext = `User ${user.id.slice(0, 12)} requests the protected grade-summary service.`;
  const encryptedRequest = await encryptAesGcm(session.sessionId, session.userSessionKey, requestPlaintext);
  const serviceResponse = await service.service.exchange({
    envelope: encryptedRequest,
  });
  const userPlaintext = await decryptAesGcm(session.userSessionKey, serviceResponse.envelope);

  state.lastPlainRequest = requestPlaintext;
  state.lastPlainResponse = userPlaintext;
  state.lastEncryptedRequest = encryptedRequest;
  state.lastEncryptedResponse = serviceResponse.envelope;
  await refreshServerState();
  log("user", "encrypted request sent", `session ${session.sessionId}`);
  log("server", "encrypted response received", `session ${session.sessionId}`);
  return snapshot();
}

export async function runForgedCertificateAttack(): Promise<SecurityDemoSnapshot> {
  const user = requireUser();
  const server = requireServer();
  const ttpPublicKeyPem = await getTtpPublicKey();

  try {
    await ttp.auth.user({
      encryptedAuthMaterial: await encryptLargePayloadForTtp(
        ttpPublicKeyPem,
        JSON.stringify({
          userId: user.id,
          userCertificatePem: server.certificatePem,
          serverId: server.serverId,
          serverCertificatePem: server.certificatePem,
          requestId: crypto.randomUUID(),
        }),
      ),
    });
    throw new Error("forged certificate was unexpectedly accepted");
  } catch (error) {
    const message = error instanceof Error ? error.message : "forged certificate rejected";
    state.forgedCertificateRejected = true;
    state.forgedCertificateMessage = message;
    log("ttp", "forged certificate rejected", message, "warn");
    return snapshot();
  }
}

export async function runMitmTamperAttack(): Promise<SecurityDemoSnapshot> {
  const session = requireSession();
  const envelope = await encryptAesGcm(session.sessionId, session.userSessionKey, "Tamper check message");
  const tampered: EncryptedEnvelope = {
    ...envelope,
    ciphertext: btoa(`${envelope.ciphertext}.`),
  };

  try {
    await service.service.exchange({ envelope: tampered });
    throw new Error("tampered ciphertext was unexpectedly accepted");
  } catch (error) {
    const message = error instanceof Error ? error.message : "tampered ciphertext rejected";
    state.mitmRejected = true;
    state.mitmMessage = message;
    await refreshServerState();
    log("server", "MITM tamper rejected", "AES-GCM authentication tag verification failed", "warn");
    return snapshot();
  }
}

export async function closeSecurityDemoSession(): Promise<SecurityDemoSnapshot> {
  const session = requireSession();
  await ttp.session.close({ sessionId: session.sessionId });
  await service.server.closeSession();
  state.session = undefined;
  await refreshServerState();
  log("ttp", "session closed", session.sessionId);
  return snapshot();
}
