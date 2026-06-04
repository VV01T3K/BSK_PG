import { beforeAll, describe, expect, it } from "bun:test";

import { aesGcm, random, rsa, type RsaPair } from "../src";

describe("crypto primitives", () => {
  let pair: RsaPair;

  beforeAll(async () => {
    pair = await rsa.generatePair();
  }, 20_000);

  it("generates AES-256 session keys", () => {
    expect(Buffer.from(random.sessionKey(), "base64")).toHaveLength(32);
  });

  it("binds encrypted payloads to the expected session id", () => {
    const key = random.sessionKey();
    const payload = aesGcm.withKey(key).forSession("session-a").encrypt("secret");

    expect(aesGcm.withKey(key).forSession("session-a").decrypt(payload)).toBe("secret");
    expect(() =>
      aesGcm
        .withKey(key)
        .forSession("session-b")
        .decrypt({ ...payload, sessionId: "session-b" }),
    ).toThrow();
  });

  it("keeps Web Crypto generated RSA keys compatible with forge operations", () => {
    const ciphertext = rsa.publicKey(pair.publicKeyPem).encrypt("identity");
    const signature = rsa.privateKey(pair.privateKeyPem).sign("claim");

    expect(rsa.privateKey(pair.privateKeyPem).decrypt(ciphertext)).toBe("identity");
    expect(rsa.publicKey(pair.publicKeyPem).verify("claim", signature)).toBe(true);
    expect(rsa.publicKey(pair.publicKeyPem).verify("changed", signature)).toBe(false);
  });
});
