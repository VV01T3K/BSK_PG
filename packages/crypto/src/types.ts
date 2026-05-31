import type forge from "node-forge";

// ===========================
// RSA
// ===========================

export type RsaPair = {
  publicKeyPem: string;
  privateKeyPem: string;
};

export interface RsaEncryptor {
  /** RSA-OAEP(SHA-256), returned base64-encoded. */
  encrypt(plaintext: string): string;
  /** RSA-wrapped AES-256-GCM session key + ciphertext, returned base64-encoded. */
  encryptHybrid(plaintext: string): string;
}

export interface RsaDecryptor {
  /** Decrypts a base64 RSA-OAEP(SHA-256) payload. */
  decrypt(payloadBase64: string): string;
  /** Decrypts a base64 hybrid (RSA-wrapped AES-256-GCM) payload. */
  decryptHybrid(payloadBase64: string): string;
}

// ===========================
// Payloads
// ===========================

export type UUID = `${string}-${string}-${string}-${string}-${string}`;

export type AesGcmPayload = {
  iv: string;
  ciphertext: string;
  authTag: string;
};

export type SessionEncryptedPayload = AesGcmPayload & {
  sessionId: string;
};

export type SessionTicket = {
  sessionId: string;
  sessionKey: string;
};

export type HybridEncryptedPayload = AesGcmPayload & {
  encryptedKey: string;
};

// ===========================
// Certificates
// ===========================

export type CertificateAuthorityOptions = {
  commonName: string;
  organization: string;
  validDays?: number;
};

export type CertificateAuthority = {
  privateKey: forge.pki.rsa.PrivateKey;
  certificate: forge.pki.Certificate;
  privateKeyPem: string;
  publicKeyPem: string;
  certificatePem: string;
};

export type PrincipalCertificateInput = {
  authority: CertificateAuthority;
  role: string;
  subjectId: string;
  publicKeyPem: string;
  organization?: string;
  validDays?: number;
};
