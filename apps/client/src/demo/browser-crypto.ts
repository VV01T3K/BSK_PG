import type { EncryptedEnvelope, RsaKeyPair } from "./types";

type HybridEncryptedEnvelope = {
  encryptedKey: string;
  iv: string;
  ciphertext: string;
  authTag: string;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  return base64ToArrayBuffer(base64);
}

function wrapPem(label: string, base64: string): string {
  const lines = base64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
}

export function randomIdSeed(role: "user" | "server"): string {
  return `${role}-${crypto.randomUUID()}`;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function fingerprint(pem: string): Promise<string> {
  const hash = await sha256Hex(pem);
  return hash.slice(0, 16).match(/.{1,2}/g)?.join(":") ?? "unknown";
}

export async function generateRsaKeyPair(): Promise<RsaKeyPair> {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 4096,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"],
  );
  const publicKeyDer = await crypto.subtle.exportKey("spki", pair.publicKey);
  return {
    publicKeyPem: wrapPem("PUBLIC KEY", arrayBufferToBase64(publicKeyDer)),
    privateKey: pair.privateKey,
  };
}

export async function encryptRsaOaepBase64(publicKeyPem: string, plaintext: string): Promise<string> {
  const publicKey = await crypto.subtle.importKey(
    "spki",
    pemToArrayBuffer(publicKeyPem),
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"],
  );
  const encrypted = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, textEncoder.encode(plaintext));
  return arrayBufferToBase64(encrypted);
}

export async function decryptRsaOaepBase64(privateKey: CryptoKey, ciphertextBase64: string): Promise<string> {
  const decrypted = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    base64ToArrayBuffer(ciphertextBase64),
  );
  return textDecoder.decode(decrypted);
}

export async function encryptLargePayloadForTtp(publicKeyPem: string, plaintext: string): Promise<string> {
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, true, ["encrypt"]);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, textEncoder.encode(plaintext));
  const encryptedBytes = new Uint8Array(encrypted);
  const authTag = encryptedBytes.slice(-16);
  const ciphertext = encryptedBytes.slice(0, -16);
  const envelope: HybridEncryptedEnvelope = {
    encryptedKey: await encryptRsaOaepBase64(publicKeyPem, arrayBufferToBase64(rawKey.buffer)),
    iv: arrayBufferToBase64(iv.buffer),
    ciphertext: arrayBufferToBase64(ciphertext.buffer),
    authTag: arrayBufferToBase64(authTag.buffer),
  };
  return btoa(JSON.stringify(envelope));
}

export async function encryptAesGcm(sessionId: string, sessionKey: string, plaintext: string): Promise<EncryptedEnvelope> {
  const rawKey = base64ToArrayBuffer(sessionKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["encrypt"]);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, textEncoder.encode(plaintext));
  const encryptedBytes = new Uint8Array(encrypted);
  const authTag = encryptedBytes.slice(-16);
  const ciphertext = encryptedBytes.slice(0, -16);

  return {
    sessionId,
    iv: arrayBufferToBase64(iv.buffer),
    ciphertext: arrayBufferToBase64(ciphertext.buffer),
    authTag: arrayBufferToBase64(authTag.buffer),
  };
}

export async function decryptAesGcm(sessionKey: string, envelope: EncryptedEnvelope): Promise<string> {
  const rawKey = base64ToArrayBuffer(sessionKey);
  const key = await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["decrypt"]);
  const ciphertext = new Uint8Array(base64ToArrayBuffer(envelope.ciphertext));
  const authTag = new Uint8Array(base64ToArrayBuffer(envelope.authTag));
  const combined = new Uint8Array(ciphertext.length + authTag.length);
  combined.set(ciphertext);
  combined.set(authTag, ciphertext.length);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToArrayBuffer(envelope.iv) },
    key,
    combined,
  );
  return textDecoder.decode(decrypted);
}
