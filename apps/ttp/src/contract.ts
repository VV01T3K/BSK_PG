import { hash, signedPayload } from "@bsk/crypto";

export type Role = "user" | "server";

export type IdentityPublicKeys = {
  authPublicKeyPem: string;
  exchangePublicKeyPem: string;
};

export type RegisterIdentityInput = {
  role: Role;
  encryptedId: string;
  publicKeys: IdentityPublicKeys;
};

export type ServerAuthenticationInput = {
  serverId: string;
  certificatePem: string;
  requestId: string;
  userId: string;
  signature: string;
};

export type UserAuthenticationRequest = {
  userId: string;
  userCertificatePem: string;
  serverId: string;
  serverCertificatePem: string;
  requestId: string;
  signature: string;
};

export type UserAuthenticationInput = {
  encryptedAuthMaterial: string;
};

export type ServerSessionKeyInput = {
  requestId: string;
};

export type UserAuthRedirectInput = {
  requestId: string;
};

/**
 * Builds the payload signed by the Server.
 * @param input Server identity, User identity, request id and certificate.
 * @returns JSON string used for RSA signature verification.
 */
export function serverAuthenticationPayload(input: {
  serverId: string;
  certificatePem: string;
  requestId: string;
  userId: string;
}) {
  return signedPayload.from({
    certificateHash: hash.of(input.certificatePem).sha256Hex(),
    requestId: input.requestId,
    role: "server",
    serverId: input.serverId,
    userId: input.userId,
  });
}

/**
 * Builds the canonical payload signed by the User.
 * @param input User, Server, request id and certificate material.
 * @returns Stable JSON string used before session-key issuance.
 */
export function userAuthenticationPayload(input: {
  userId: string;
  userCertificatePem: string;
  serverId: string;
  serverCertificatePem: string;
  requestId: string;
}) {
  return signedPayload.from({
    requestId: input.requestId,
    role: "user",
    serverCertificateHash: hash.of(input.serverCertificatePem).sha256Hex(),
    serverId: input.serverId,
    userCertificateHash: hash.of(input.userCertificatePem).sha256Hex(),
    userId: input.userId,
  });
}
