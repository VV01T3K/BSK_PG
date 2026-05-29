import { createDecipheriv, randomBytes } from "node:crypto";
import forge from "node-forge";
import type { HybridEncryptedEnvelope } from "./types.js";

export const RSA_BITS = 4096;

function randomHex(bytes: number): string {
  return randomBytes(bytes).toString("hex");
}

function createCertificateAuthority() {
  const keys = forge.pki.rsa.generateKeyPair({ bits: RSA_BITS, workers: -1 });
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = randomHex(16);
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const attrs = [
    { name: "commonName", value: "BSK PG Trusted Third Party" },
    { name: "organizationName", value: "BSK PG Demo" },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    { name: "basicConstraints", cA: true },
    { name: "keyUsage", keyCertSign: true, digitalSignature: true, keyEncipherment: true },
    { name: "subjectKeyIdentifier" },
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  return {
    privateKey: keys.privateKey,
    publicKeyPem: forge.pki.publicKeyToPem(keys.publicKey),
    certificatePem: forge.pki.certificateToPem(cert),
  };
}

export const ca = createCertificateAuthority();

export function compactPem(pem: string): string {
  return pem.replace(/\s+/g, "");
}

export function newRandomHex(bytes: number): string {
  return randomHex(bytes);
}

export function newSessionKey(): string {
  return randomBytes(32).toString("base64");
}

export function decryptWithTtpPrivateKey(ciphertextBase64: string): string {
  const ciphertext = forge.util.decode64(ciphertextBase64);
  return ca.privateKey.decrypt(ciphertext, "RSA-OAEP", {
    md: forge.md.sha256.create(),
    mgf1: { md: forge.md.sha256.create() },
  });
}

export function decryptHybridWithTtpPrivateKey(envelopeBase64: string): string {
  const envelope = JSON.parse(Buffer.from(envelopeBase64, "base64").toString("utf8")) as HybridEncryptedEnvelope;
  const sessionKey = Buffer.from(decryptWithTtpPrivateKey(envelope.encryptedKey), "base64");
  const decipher = createDecipheriv("aes-256-gcm", sessionKey, Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function encryptForPublicKey(publicKeyPem: string, payload: unknown): string {
  const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
  const encrypted = publicKey.encrypt(JSON.stringify(payload), "RSA-OAEP", {
    md: forge.md.sha256.create(),
    mgf1: { md: forge.md.sha256.create() },
  });
  return forge.util.encode64(encrypted);
}
