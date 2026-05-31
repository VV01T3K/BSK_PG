import { service, ttp } from "#/api";
import {
  decryptRsaOaepBase64,
  encryptAesGcm,
  encryptLargePayloadForTtp,
  encryptRsaOaepBase64,
  generateRsaKeyPair,
  randomIdSeed,
  sha256Hex,
} from "./browser-crypto";
import { clearClientState, requireSession, requireUser, snapshot, state } from "./state";
import type { AttackResult, EncryptedEnvelope, PrincipalState, SecurityDemoSnapshot, ServiceServerSnapshot } from "./types";

async function getTtpPublicKey(): Promise<string> {
  const payload = await ttp.publicKey();
  return payload.publicKeyPem;
}

async function requireServer(): Promise<ServiceServerSnapshot & { serverId: string; certificatePem: string }> {
  const server = await service.state();
  if (!server.registered || !server.serverId || !server.certificatePem) {
    throw new Error("protected service server is not registered yet");
  }
  return server as ServiceServerSnapshot & { serverId: string; certificatePem: string };
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
  return {
    id: registration.subjectId,
    exchangeKeyPair,
    certificatePem: registration.certificatePem,
    issuedAt: registration.issuedAt,
  };
}

async function decryptSessionKey(user: PrincipalState, encryptedSessionKey: string): Promise<{ sessionId: string; sessionKey: string }> {
  return JSON.parse(await decryptRsaOaepBase64(user.exchangeKeyPair.privateKey, encryptedSessionKey)) as {
    sessionId: string;
    sessionKey: string;
  };
}

export async function getSecurityDemoState(): Promise<SecurityDemoSnapshot> {
  const server = await service.state().catch(() => undefined);
  return snapshot(server);
}

export async function resetSecurityDemo(): Promise<SecurityDemoSnapshot> {
  clearClientState();
  const server = await service.reset();
  return snapshot(server);
}

export async function registerSecurityDemoRoles(): Promise<SecurityDemoSnapshot> {
  state.user = await registerUser();
  const server = await service.server.register();
  state.session = undefined;
  return snapshot(server);
}

export async function authenticateSecurityDemoSession(): Promise<SecurityDemoSnapshot> {
  const user = requireUser();
  const server = await requireServer();
  const requestId = crypto.randomUUID();

  await service.server.authenticate({ requestId });

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
  return snapshot(await service.state());
}

export async function exchangeEncryptedServiceMessage(): Promise<SecurityDemoSnapshot> {
  const session = requireSession();
  const user = requireUser();
  const requestPlaintext = `User ${user.id.slice(0, 12)} requests the protected grade-summary service.`;
  const encryptedRequest = await encryptAesGcm(session.sessionId, session.userSessionKey, requestPlaintext);
  await service.service.exchange({
    envelope: encryptedRequest,
  });
  return snapshot(await service.state());
}

export async function runForgedCertificateAttack(): Promise<AttackResult> {
  const user = requireUser();
  const server = await requireServer();
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
    return { rejected: true, message: error instanceof Error ? error.message : "forged certificate rejected" };
  }
}

export async function runMitmTamperAttack(): Promise<AttackResult> {
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
    return { rejected: true, message: error instanceof Error ? error.message : "tampered ciphertext rejected" };
  }
}

export async function closeSecurityDemoSession(): Promise<SecurityDemoSnapshot> {
  const session = requireSession();
  await ttp.session.close({ sessionId: session.sessionId });
  await service.server.closeSession();
  state.session = undefined;
  return snapshot(await service.state());
}
