import { beforeEach, describe, expect, it } from "bun:test";

import { hash } from "@bsk/crypto";

import { clientSecurityState, type RegisteredUser } from "../src/lib/client-security-state";

const user: RegisteredUser = {
  id: "user-1",
  authKeyPair: {
    publicKeyPem: "auth-public",
    privateKeyPem: "auth-private",
  },
  exchangeKeyPair: {
    publicKeyPem: "exchange-public",
    privateKeyPem: "exchange-private",
  },
  certificatePem: "user-certificate",
};

const session = {
  sessionId: "session-1",
  userSessionKey: "session-key",
};

describe("clientSecurityState", () => {
  beforeEach(() => {
    clientSecurityState.reset();
  });

  it("starts with no user or session", () => {
    expect(clientSecurityState.read()).toEqual({});
    expect(clientSecurityState.readPublicStatus()).toEqual({
      userRegistered: false,
      userId: undefined,
      userCertificateFingerprint: undefined,
      sessionId: undefined,
    });
  });

  it("stores user registration and exposes only public status", () => {
    clientSecurityState.storeUser(user);

    expect(clientSecurityState.read()).toEqual({ user });
    expect(clientSecurityState.readPublicStatus()).toEqual({
      userRegistered: true,
      userId: "user-1",
      userCertificateFingerprint: hash.of(user.certificatePem).fingerprint(),
      sessionId: undefined,
    });
  });

  it("stores and clears the active session without removing the user", () => {
    clientSecurityState.storeUser(user);
    clientSecurityState.storeSession(session);

    expect(clientSecurityState.read()).toEqual({ user, session });
    expect(clientSecurityState.readPublicStatus().sessionId).toBe("session-1");

    clientSecurityState.clearSession();

    expect(clientSecurityState.read()).toEqual({ user });
    expect(clientSecurityState.readPublicStatus().sessionId).toBeUndefined();
  });

  it("clears an old session when a new user is stored", () => {
    clientSecurityState.storeUser(user);
    clientSecurityState.storeSession(session);

    clientSecurityState.storeUser({ ...user, id: "user-2" });

    expect(clientSecurityState.read()).toEqual({
      user: { ...user, id: "user-2" },
    });
    expect(clientSecurityState.readPublicStatus()).toMatchObject({
      userRegistered: true,
      userId: "user-2",
      sessionId: undefined,
    });
  });

  it("resets all client-side security state", () => {
    clientSecurityState.storeUser(user);
    clientSecurityState.storeSession(session);

    clientSecurityState.reset();

    expect(clientSecurityState.read()).toEqual({});
    expect(clientSecurityState.readPublicStatus().userRegistered).toBe(false);
  });
});
