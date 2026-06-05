import type forge from "node-forge";

// ===========================
// RSA
// ===========================

export type RsaPair = {
  publicKeyPem: string;
  privateKeyPem: string;
};

export interface RsaEncryptor {
  /** Hybrid public-key encryption using RSA-OAEP(SHA-256)-wrapped AES-256-GCM. */
  encrypt(plaintext: string): string;
  /** Verifies a base64 RSA/SHA-256 signature for the given plaintext. */
  verify(plaintext: string, signatureBase64: string): boolean;
}

export interface RsaDecryptor {
  /** Decrypts a base64 hybrid public-key payload. */
  decrypt(payloadBase64: string): string;
  /** Signs the given plaintext with RSA/SHA-256 and returns a base64 signature. */
  sign(plaintext: string): string;
}

// ===========================
// Payloads
// ===========================

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

export type IdentityCertificateInput = {
  authority: CertificateAuthority;
  role: string;
  subjectId: string;
  publicKeyPem: string;
  organization?: string;
  validDays?: number;
};
