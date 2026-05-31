import forge from "node-forge";

export const RSA_BITS = 4096;

const AES_GCM_TAG_BITS = 128;
const AES_GCM_IV_BYTES = 12;
const AES_256_KEY_BYTES = 32;

export type RsaPair = {
  publicKeyPem: string;
  privateKeyPem: string;
};

export type AesGcmPayload = {
  iv: string;
  ciphertext: string;
  authTag: string;
};

export type EncryptedEnvelope = AesGcmPayload & {
  sessionId: string;
};

export type SessionTicket = {
  sessionId: string;
  sessionKey: string;
};

type HybridEncryptedEnvelope = AesGcmPayload & {
  encryptedKey: string;
};

function rsaOaepSha256() {
  return {
    md: forge.md.sha256.create(),
    mgf1: { md: forge.md.sha256.create() },
  };
}

function encryptRsaOaepSha256(publicKey: forge.pki.rsa.PublicKey, plaintext: string): string {
  return publicKey.encrypt(plaintext, "RSA-OAEP", rsaOaepSha256());
}

function decryptRsaOaepSha256(privateKey: forge.pki.rsa.PrivateKey, ciphertext: string): string {
  return privateKey.decrypt(ciphertext, "RSA-OAEP", rsaOaepSha256());
}

function encodeHybridEnvelopeBase64(envelope: HybridEncryptedEnvelope): string {
  return forge.util.encode64(forge.util.encodeUtf8(JSON.stringify(envelope)));
}

function decodeHybridEnvelope(envelopeBytes: string): HybridEncryptedEnvelope {
  return JSON.parse(forge.util.decodeUtf8(envelopeBytes)) as HybridEncryptedEnvelope;
}

export const hash = {
  of(value: string) {
    const sha256Hex = () => {
      const digest = forge.md.sha256.create();
      digest.update(value, "utf8");
      return digest.digest().toHex();
    };

    return {
      sha256Hex,
      fingerprint() {
        const prefix = sha256Hex().slice(0, 16);
        const bytes = prefix.match(/.{1,2}/g);
        return bytes?.join(":") ?? "unknown";
      },
    };
  },
};

export const random = {
  hex(bytes: number): string {
    const value = forge.random.getBytesSync(bytes);
    return forge.util.bytesToHex(value);
  },

  sessionKey(): string {
    const key = forge.random.getBytesSync(AES_256_KEY_BYTES);
    return forge.util.encode64(key);
  },
};

export const aesGcm = {
  withKey(sessionKey: string) {
    const encrypt = (plaintext: string): AesGcmPayload => {
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
    };

    const decrypt = (envelope: AesGcmPayload): string => {
      const decipher = forge.cipher.createDecipher("AES-GCM", forge.util.decode64(sessionKey));
      decipher.start({
        iv: forge.util.decode64(envelope.iv),
        tag: forge.util.createBuffer(forge.util.decode64(envelope.authTag)),
        tagLength: AES_GCM_TAG_BITS,
      });
      decipher.update(forge.util.createBuffer(forge.util.decode64(envelope.ciphertext)));
      if (!decipher.finish()) throw new Error("AES-GCM authentication failed");
      return forge.util.decodeUtf8(decipher.output.getBytes());
    };

    return {
      encrypt,
      decrypt,
      forSession(sessionId: string) {
        return {
          encrypt(plaintext: string): EncryptedEnvelope {
            return { sessionId, ...encrypt(plaintext) };
          },

          decrypt(envelope: EncryptedEnvelope): string {
            if (envelope.sessionId !== sessionId) {
              throw new Error("encrypted envelope session id does not match expected session");
            }
            return decrypt(envelope);
          },
        };
      },
    };
  },
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

export const rsa = {
  generatePair(): RsaPair {
    const pair = forge.pki.rsa.generateKeyPair({ bits: RSA_BITS, workers: -1 });
    return {
      publicKeyPem: forge.pki.publicKeyToPem(pair.publicKey),
      privateKeyPem: forge.pki.privateKeyToPem(pair.privateKey),
    };
  },

  publicKey(publicKeyPem: string): RsaEncryptor {
    const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);

    return {
      encrypt(plaintext) {
        return forge.util.encode64(encryptRsaOaepSha256(publicKey, plaintext));
      },
      encryptHybrid(plaintext) {
        const sessionKey = random.sessionKey();
        const envelope: HybridEncryptedEnvelope = {
          encryptedKey: forge.util.encode64(encryptRsaOaepSha256(publicKey, sessionKey)),
          ...aesGcm.withKey(sessionKey).encrypt(plaintext),
        };
        return encodeHybridEnvelopeBase64(envelope);
      },
    };
  },

  privateKey(privateKeyPem: string): RsaDecryptor {
    const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);

    return {
      decrypt(payloadBase64) {
        return decryptRsaOaepSha256(privateKey, forge.util.decode64(payloadBase64));
      },
      decryptHybrid(payloadBase64) {
        const envelope = decodeHybridEnvelope(forge.util.decode64(payloadBase64));
        const sessionKey = decryptRsaOaepSha256(privateKey, forge.util.decode64(envelope.encryptedKey));
        return aesGcm.withKey(sessionKey).decrypt(envelope);
      },
    };
  },
};

export {
  createCertificateAuthority,
  issuePrincipalCertificate,
  type CertificateAuthority,
} from "./certificates.js";
