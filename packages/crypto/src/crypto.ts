import forge from "node-forge";

import type {
  AesGcmPayload,
  HybridEncryptedPayload,
  SessionEncryptedPayload,
  RsaDecryptor,
  RsaEncryptor,
  RsaPair,
} from "./types";

export const RSA_BITS = 4096;

const AES_GCM_TAG_BITS = 128;
const AES_GCM_IV_BYTES = 12;
const AES_256_KEY_BYTES = 32;

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

function sha256Digest(value: string) {
  const digest = forge.md.sha256.create();
  digest.update(value, "utf8");
  return digest;
}

function encodeHybridPayloadBase64(payload: HybridEncryptedPayload): string {
  return forge.util.encode64(forge.util.encodeUtf8(JSON.stringify(payload)));
}

function decodeHybridPayload(payloadBytes: string): HybridEncryptedPayload {
  return JSON.parse(forge.util.decodeUtf8(payloadBytes)) as HybridEncryptedPayload;
}

function derToPem(label: "PUBLIC KEY" | "PRIVATE KEY", der: ArrayBuffer): string {
  return forge.pem.encode({
    type: label,
    body: forge.util.binary.raw.encode(new Uint8Array(der)),
  });
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

  uuid() {
    return crypto.randomUUID();
  },

  sessionKey(): string {
    const key = forge.random.getBytesSync(AES_256_KEY_BYTES);
    return forge.util.encode64(key);
  },
};

export const signedPayload = {
  from(fields: Record<string, string>): string {
    const sortedFields = Object.fromEntries(
      Object.entries(fields).sort(([left], [right]) => left.localeCompare(right)),
    );
    return JSON.stringify(sortedFields);
  },
};

export const aesGcm = {
  withKey(sessionKey: string) {
    const encrypt = (plaintext: string, additionalData?: string): AesGcmPayload => {
      const iv = forge.random.getBytesSync(AES_GCM_IV_BYTES);
      const cipher = forge.cipher.createCipher("AES-GCM", forge.util.decode64(sessionKey));
      cipher.start({
        iv,
        additionalData: additionalData ? forge.util.encodeUtf8(additionalData) : undefined,
        tagLength: AES_GCM_TAG_BITS,
      });
      cipher.update(forge.util.createBuffer(forge.util.encodeUtf8(plaintext)));
      if (!cipher.finish()) throw new Error("AES-GCM encryption failed");

      return {
        iv: forge.util.encode64(iv),
        ciphertext: forge.util.encode64(cipher.output.getBytes()),
        authTag: forge.util.encode64(cipher.mode.tag.getBytes()),
      };
    };

    const decrypt = (payload: AesGcmPayload, additionalData?: string): string => {
      const decipher = forge.cipher.createDecipher("AES-GCM", forge.util.decode64(sessionKey));
      decipher.start({
        iv: forge.util.decode64(payload.iv),
        additionalData: additionalData ? forge.util.encodeUtf8(additionalData) : undefined,
        tag: forge.util.createBuffer(forge.util.decode64(payload.authTag)),
        tagLength: AES_GCM_TAG_BITS,
      });
      decipher.update(forge.util.createBuffer(forge.util.decode64(payload.ciphertext)));
      if (!decipher.finish()) throw new Error("AES-GCM authentication failed");
      return forge.util.decodeUtf8(decipher.output.getBytes());
    };

    return {
      encrypt,
      decrypt,
      forSession(sessionId: string) {
        return {
          encrypt(plaintext: string): SessionEncryptedPayload {
            return { sessionId, ...encrypt(plaintext, sessionId) };
          },

          decrypt(payload: SessionEncryptedPayload): string {
            if (payload.sessionId !== sessionId) {
              throw new Error("encrypted payload session id does not match expected session");
            }
            return decrypt(payload, sessionId);
          },
        };
      },
    };
  },
};

export const rsa = {
  async generatePair(): Promise<RsaPair> {
    const pair = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: RSA_BITS,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"],
    );
    const [publicKeyDer, privateKeyDer] = await Promise.all([
      crypto.subtle.exportKey("spki", pair.publicKey),
      crypto.subtle.exportKey("pkcs8", pair.privateKey),
    ]);

    return {
      publicKeyPem: derToPem("PUBLIC KEY", publicKeyDer),
      privateKeyPem: derToPem("PRIVATE KEY", privateKeyDer),
    };
  },

  publicKey(publicKeyPem: string): RsaEncryptor {
    const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);

    return {
      encrypt(plaintext) {
        const sessionKey = random.sessionKey();
        const payload: HybridEncryptedPayload = {
          encryptedKey: forge.util.encode64(encryptRsaOaepSha256(publicKey, sessionKey)),
          ...aesGcm.withKey(sessionKey).encrypt(plaintext),
        };
        return encodeHybridPayloadBase64(payload);
      },
      verify(plaintext, signatureBase64) {
        try {
          return publicKey.verify(
            sha256Digest(plaintext).digest().bytes(),
            forge.util.decode64(signatureBase64),
          );
        } catch {
          return false;
        }
      },
    };
  },

  privateKey(privateKeyPem: string): RsaDecryptor {
    const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);

    return {
      decrypt(payloadBase64) {
        const payload = decodeHybridPayload(forge.util.decode64(payloadBase64));
        const sessionKey = decryptRsaOaepSha256(
          privateKey,
          forge.util.decode64(payload.encryptedKey),
        );
        return aesGcm.withKey(sessionKey).decrypt(payload);
      },
      sign(plaintext) {
        return forge.util.encode64(privateKey.sign(sha256Digest(plaintext)));
      },
    };
  },
};
