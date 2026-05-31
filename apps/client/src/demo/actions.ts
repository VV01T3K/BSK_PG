import {
  aesGcm,
  hash,
  random,
  rsa,
  type SessionTicket,
} from "@bsk/crypto";
import { service, ttp } from "#/api";
import { clearClientState, requireSession, requireUser, state } from "./state";
import type { AttackResult, EncryptedEnvelope, PrincipalState, ServiceServerSnapshot } from "./types";

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
  const id = hash.of(`user-${random.hex(16)}`).sha256Hex();
  const ttpPublicKeyPem = await getTtpPublicKey();
  const authKeyPair = rsa.generatePair();
  const exchangeKeyPair = rsa.generatePair();
  const registration = await ttp.register({
    role: "user",
    encryptedId: rsa.publicKey(ttpPublicKeyPem).encrypt(id),
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

export async function resetSecurityDemo(): Promise<void> {
  clearClientState();
  await service.reset();
}

export async function registerSecurityDemoRoles(): Promise<void> {
  state.user = await registerUser();
  await service.server.register();
  state.session = undefined;
}

export async function authenticateSecurityDemoSession(): Promise<void> {
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
    encryptedAuthMaterial: rsa
      .publicKey(ttpPublicKeyPem)
      .encryptHybrid(JSON.stringify(authMaterial)),
  });

  const userSession = JSON.parse(
    rsa
      .privateKey(user.exchangeKeyPair.privateKeyPem)
      .decrypt(userAuth.encryptedSessionKeyForUser),
  ) as SessionTicket;
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
}

export async function exchangeEncryptedServiceMessage(): Promise<void> {
  const session = requireSession();
  const user = requireUser();
  const requestPlaintext = `User ${user.id.slice(0, 12)} requests the protected grade-summary service.`;
  const encryptedRequest = aesGcm
    .withKey(session.userSessionKey)
    .forSession(session.sessionId)
    .encrypt(requestPlaintext);
  await service.service.exchange({
    envelope: encryptedRequest,
  });
}

export async function runForgedCertificateAttack(): Promise<AttackResult> {
  const user = requireUser();
  const server = await requireServer();
  const ttpPublicKeyPem = await getTtpPublicKey();

  try {
    await ttp.auth.user({
      encryptedAuthMaterial: rsa
        .publicKey(ttpPublicKeyPem)
        .encryptHybrid(
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
  const envelope = aesGcm
    .withKey(session.userSessionKey)
    .forSession(session.sessionId)
    .encrypt("Tamper check message");
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

export async function closeSecurityDemoSession(): Promise<void> {
  const session = requireSession();
  await ttp.session.close({ sessionId: session.sessionId });
  await service.server.closeSession();
  state.session = undefined;
}
