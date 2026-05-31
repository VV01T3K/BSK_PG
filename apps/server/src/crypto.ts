import {
  constants,
  createCipheriv,
  createDecipheriv,
  createHash,
  generateKeyPairSync,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
} from "node:crypto";
import type { EncryptedEnvelope } from "./types.js";

export type RsaPair = {
  publicKeyPem: string;
  privateKeyPem: string;
};

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function fingerprint(pem: string): string {
  return sha256(pem).slice(0, 16).match(/.{1,2}/g)?.join(":") ?? "unknown";
}

export function generateRsaPair(): RsaPair {
  const pair = generateKeyPairSync("rsa", {
    modulusLength: 4096,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { publicKeyPem: pair.publicKey, privateKeyPem: pair.privateKey };
}

export function encryptForTtp(publicKeyPem: string, payload: string): string {
  return publicEncrypt(
    {
      key: publicKeyPem,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(payload, "utf8"),
  ).toString("base64");
}

export function decryptWithPrivateKey(privateKeyPem: string, payloadBase64: string): string {
  return privateDecrypt(
    {
      key: privateKeyPem,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(payloadBase64, "base64"),
  ).toString("utf8");
}

export function encryptAesGcm(sessionId: string, sessionKey: string, plaintext: string): EncryptedEnvelope {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(sessionKey, "base64"), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    sessionId,
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptAesGcm(sessionKey: string, envelope: EncryptedEnvelope): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(sessionKey, "base64"),
    Buffer.from(envelope.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
