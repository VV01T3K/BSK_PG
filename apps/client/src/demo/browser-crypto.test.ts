import { describe, expect, it } from "vitest";
import { decryptAesGcm, decryptRsaOaepBase64, encryptAesGcm, encryptRsaOaepBase64, generateRsaKeyPair, sha256Hex } from "./browser-crypto";

describe("browser crypto helpers", () => {
  it("hashes with SHA-256", async () => {
    expect(await sha256Hex("BSK")).toHaveLength(64);
  });

  it("encrypts and decrypts RSA-OAEP payloads", async () => {
    const keyPair = await generateRsaKeyPair();
    const encrypted = await encryptRsaOaepBase64(keyPair.publicKeyPem, "secret id");
    await expect(decryptRsaOaepBase64(keyPair.privateKey, encrypted)).resolves.toBe("secret id");
  });

  it("encrypts and decrypts AES-GCM envelopes", async () => {
    const rawKey = crypto.getRandomValues(new Uint8Array(32));
    const sessionKey = btoa(String.fromCharCode(...rawKey));
    const envelope = await encryptAesGcm("session-1", sessionKey, "service payload");
    await expect(decryptAesGcm(sessionKey, envelope)).resolves.toBe("service payload");
  });
});
