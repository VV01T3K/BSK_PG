import { describe, expect, it } from "vitest";
import { decryptAesGcm, encryptAesGcm, generateRsaPair, newSessionKey, rsaDecryptBase64, rsaEncryptBase64, sha256Hex } from "@bsk/crypto";

describe("browser crypto helpers", () => {
  it("hashes with SHA-256", () => {
    expect(sha256Hex("BSK")).toHaveLength(64);
  });

  it("encrypts and decrypts RSA-OAEP payloads", () => {
    const keyPair = generateRsaPair();
    const encrypted = rsaEncryptBase64(keyPair.publicKeyPem, "secret id");
    expect(rsaDecryptBase64(keyPair.privateKeyPem, encrypted)).toBe("secret id");
  });

  it("encrypts and decrypts AES-GCM envelopes", () => {
    const sessionKey = newSessionKey();
    const envelope = encryptAesGcm(sessionKey, "service payload", "session-1");
    expect(decryptAesGcm(sessionKey, envelope)).toBe("service payload");
  });
});
