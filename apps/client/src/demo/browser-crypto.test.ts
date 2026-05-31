import { describe, expect, it } from "vitest";
import { aesGcm, hash, random, rsa } from "@bsk/crypto";

describe("browser crypto helpers", () => {
  it("hashes with SHA-256", () => {
    expect(hash.of("BSK").sha256Hex()).toHaveLength(64);
  });

  it("encrypts and decrypts RSA-OAEP payloads", () => {
    const keyPair = rsa.generatePair();
    const encrypted = rsa.publicKey(keyPair.publicKeyPem).encrypt("secret id");
    expect(rsa.privateKey(keyPair.privateKeyPem).decrypt(encrypted)).toBe("secret id");
  });

  it("encrypts and decrypts AES-GCM envelopes", () => {
    const sessionKey = random.sessionKey();
    const envelope = aesGcm
      .withKey(sessionKey)
      .forSession("session-1")
      .encrypt("service payload");
    expect(aesGcm.withKey(sessionKey).decrypt(envelope)).toBe("service payload");
  });
});
