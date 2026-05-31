import forge from "node-forge";

export const RSA_BITS = 4096;
const AES_GCM_TAG_BITS = 128;
const AES_GCM_IV_BYTES = 12;
const AES_256_KEY_BYTES = 32;

export type RsaPair = {
  publicKeyPem: string;
  privateKeyPem: string;
};

export type EncryptedEnvelope = {
  sessionId: string;
  iv: string;
  ciphertext: string;
  authTag: string;
};

type HybridEncryptedEnvelope = Omit<EncryptedEnvelope, "sessionId"> & {
  encryptedKey: string;
};

function rsaOaepSha256() {
  return { md: forge.md.sha256.create(), mgf1: { md: forge.md.sha256.create() } };
}

export function sha256Hex(value: string): string {
  const digest = forge.md.sha256.create();
  digest.update(value, "utf8");
  return digest.digest().toHex();
}

export function fingerprint(pem: string): string {
  return sha256Hex(pem).slice(0, 16).match(/.{1,2}/g)?.join(":") ?? "unknown";
}

export function randomHex(bytes: number): string {
  return forge.util.bytesToHex(forge.random.getBytesSync(bytes));
}

export function newSessionKey(): string {
  return forge.util.encode64(forge.random.getBytesSync(AES_256_KEY_BYTES));
}

export function generateRsaPair(): RsaPair {
  const pair = forge.pki.rsa.generateKeyPair({ bits: RSA_BITS, workers: -1 });
  return {
    publicKeyPem: forge.pki.publicKeyToPem(pair.publicKey),
    privateKeyPem: forge.pki.privateKeyToPem(pair.privateKey),
  };
}

export function rsaEncryptBase64(publicKeyPem: string, plaintext: string): string {
  const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
  return forge.util.encode64(publicKey.encrypt(plaintext, "RSA-OAEP", rsaOaepSha256()));
}

export function rsaDecryptBase64(privateKeyPem: string, ciphertextBase64: string): string {
  const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
  return privateKey.decrypt(forge.util.decode64(ciphertextBase64), "RSA-OAEP", rsaOaepSha256());
}

export function encryptAesGcm(sessionId: string, sessionKey: string, plaintext: string): EncryptedEnvelope {
  return { sessionId, ...encryptAesGcmPayload(sessionKey, plaintext) };
}

export function decryptAesGcm(sessionKey: string, envelope: Pick<EncryptedEnvelope, "iv" | "ciphertext" | "authTag">): string {
  const decipher = forge.cipher.createDecipher("AES-GCM", forge.util.decode64(sessionKey));
  decipher.start({
    iv: forge.util.decode64(envelope.iv),
    tag: forge.util.createBuffer(forge.util.decode64(envelope.authTag)),
    tagLength: AES_GCM_TAG_BITS,
  });
  decipher.update(forge.util.createBuffer(forge.util.decode64(envelope.ciphertext)));
  if (!decipher.finish()) throw new Error("AES-GCM authentication failed");
  return forge.util.decodeUtf8(decipher.output.getBytes());
}

export function encryptHybridForPublicKey(publicKeyPem: string, plaintext: string): string {
  const sessionKey = newSessionKey();
  const envelope: HybridEncryptedEnvelope = {
    encryptedKey: rsaEncryptBase64(publicKeyPem, sessionKey),
    ...encryptAesGcmPayload(sessionKey, plaintext),
  };
  return forge.util.encode64(forge.util.encodeUtf8(JSON.stringify(envelope)));
}

export function decryptHybridWithPrivateKey(privateKeyPem: string, envelopeBase64: string): string {
  const envelope = JSON.parse(forge.util.decodeUtf8(forge.util.decode64(envelopeBase64))) as HybridEncryptedEnvelope;
  const sessionKey = rsaDecryptBase64(privateKeyPem, envelope.encryptedKey);
  return decryptAesGcm(sessionKey, envelope);
}

function encryptAesGcmPayload(sessionKey: string, plaintext: string): Omit<EncryptedEnvelope, "sessionId"> {
  const iv = forge.random.getBytesSync(AES_GCM_IV_BYTES);
  const cipher = forge.cipher.createCipher("AES-GCM", forge.util.decode64(sessionKey));
  cipher.start({ iv, tagLength: AES_GCM_TAG_BITS });
  cipher.update(forge.util.createBuffer(forge.util.encodeUtf8(plaintext)));
  if (!cipher.finish()) throw new Error("AES-GCM encryption failed");

  return {
    iv: forge.util.encode64(iv),
    ciphertext: forge.util.encode64(cipher.output.getBytes()),
    authTag: forge.util.encode64(cipher.mode.tag.getBytes()),
  };
}
