import forge from "node-forge";
import { beforeAll, describe, expect, it } from "vitest";
import { aesGcm, hash, random, rsa, type RsaPair } from "../src/index";

/** Flip the first byte of a base64 blob so the decoded bytes are guaranteed to differ. */
function tamperBase64(value: string): string {
  const raw = forge.util.decode64(value);
  const flipped = String.fromCharCode(raw.charCodeAt(0) ^ 0xff) + raw.slice(1);
  return forge.util.encode64(flipped);
}

describe("hash", () => {
  it("produces a 64-char hex SHA-256 digest", () => {
    expect(hash.of("BSK").sha256Hex()).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for identical input and differs for different input", () => {
    expect(hash.of("payload").sha256Hex()).toBe(hash.of("payload").sha256Hex());
    expect(hash.of("a").sha256Hex()).not.toBe(hash.of("b").sha256Hex());
  });

  it("formats a fingerprint as eight colon-separated byte pairs", () => {
    expect(hash.of("BSK").fingerprint()).toMatch(/^([0-9a-f]{2}:){7}[0-9a-f]{2}$/);
  });
});

describe("random", () => {
  it("hex(n) returns 2n hex characters", () => {
    expect(random.hex(16)).toMatch(/^[0-9a-f]{32}$/);
  });

  it("produces distinct values across calls", () => {
    expect(random.hex(16)).not.toBe(random.hex(16));
  });

  it("uuid() returns an RFC 4122 version 4 identifier", () => {
    expect(random.uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("sessionKey() decodes to a 256-bit (32 byte) key", () => {
    expect(Buffer.from(random.sessionKey(), "base64")).toHaveLength(32);
  });
});

describe("aesGcm", () => {
  it("round-trips a plaintext with withKey()", () => {
    const key = random.sessionKey();
    const payload = aesGcm.withKey(key).encrypt("service payload");
    expect(aesGcm.withKey(key).decrypt(payload)).toBe("service payload");
  });

  it("forSession() round-trips and stamps the session id", () => {
    const key = random.sessionKey();
    const cipher = aesGcm.withKey(key).forSession("session-1");
    const payload = cipher.encrypt("classified");
    expect(payload.sessionId).toBe("session-1");
    expect(cipher.decrypt(payload)).toBe("classified");
  });

  it("rejects a payload decrypted under the wrong session id", () => {
    const key = random.sessionKey();
    const payload = aesGcm.withKey(key).forSession("session-1").encrypt("classified");
    const wrongSession = aesGcm.withKey(key).forSession("session-2");
    expect(() => wrongSession.decrypt(payload)).toThrow();
  });

  it("fails authentication when the ciphertext is tampered with", () => {
    const cipher = aesGcm.withKey(random.sessionKey());
    const payload = cipher.encrypt("classified");
    expect(() => cipher.decrypt({ ...payload, ciphertext: tamperBase64(payload.ciphertext) })).toThrow();
  });

  it("fails authentication when the auth tag is tampered with", () => {
    const cipher = aesGcm.withKey(random.sessionKey());
    const payload = cipher.encrypt("classified");
    expect(() => cipher.decrypt({ ...payload, authTag: tamperBase64(payload.authTag) })).toThrow();
  });
});

describe("rsa", () => {
  let pair: RsaPair;
  let otherPair: RsaPair;

  beforeAll(() => {
    pair = rsa.generatePair();
    otherPair = rsa.generatePair();
  }, 60_000);

  it("generatePair() returns PEM-encoded keys", () => {
    expect(pair.publicKeyPem).toContain("BEGIN PUBLIC KEY");
    expect(pair.privateKeyPem).toContain("PRIVATE KEY");
  });

  it("encrypt() -> decrypt() round-trips with base64 ciphertext", () => {
    const ciphertext = rsa.publicKey(pair.publicKeyPem).encrypt("secret id");
    expect(ciphertext).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(rsa.privateKey(pair.privateKeyPem).decrypt(ciphertext)).toBe("secret id");
  });

  it("encryptHybrid() -> decryptHybrid() round-trips a payload larger than the RSA modulus", () => {
    const big = "x".repeat(4000);
    const ciphertext = rsa.publicKey(pair.publicKeyPem).encryptHybrid(big);
    expect(rsa.privateKey(pair.privateKeyPem).decryptHybrid(ciphertext)).toBe(big);
  });

  it("plain encrypt() rejects a payload larger than the RSA modulus", () => {
    expect(() => rsa.publicKey(pair.publicKeyPem).encrypt("x".repeat(4000))).toThrow();
  });

  it("decrypting with a non-matching private key throws", () => {
    const ciphertext = rsa.publicKey(pair.publicKeyPem).encrypt("secret id");
    expect(() => rsa.privateKey(otherPair.privateKeyPem).decrypt(ciphertext)).toThrow();
  });
});
