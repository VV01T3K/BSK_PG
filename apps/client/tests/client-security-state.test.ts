import { beforeEach, describe, expect, it } from "bun:test";

import { clientSecurityState, type RegisteredUser } from "../src/lib/client-security-state";

const user: RegisteredUser = {
  id: "user-1",
  authKeyPair: { publicKeyPem: "auth-public", privateKeyPem: "auth-private" },
  exchangeKeyPair: { publicKeyPem: "exchange-public", privateKeyPem: "exchange-private" },
  certificatePem: "user-certificate",
};

describe("clientSecurityState", () => {
  beforeEach(() => {
    clientSecurityState.reset();
  });

  it("stores only public registration and session status for the UI", () => {
    clientSecurityState.storeUser(user);
    clientSecurityState.storeSession({ sessionId: "session-1", userSessionKey: "key" });

    expect(clientSecurityState.read()).toMatchObject({ user });
    expect(clientSecurityState.readPublicStatus()).toMatchObject({
      userRegistered: true,
      userId: "user-1",
      sessionId: "session-1",
    });
  });

  it("clears stale session data when identity changes or resets", () => {
    clientSecurityState.storeUser(user);
    clientSecurityState.storeSession({ sessionId: "old-session", userSessionKey: "key" });
    clientSecurityState.storeUser({ ...user, id: "user-2" });

    expect(clientSecurityState.readPublicStatus().sessionId).toBeUndefined();

    clientSecurityState.reset();
    expect(clientSecurityState.read()).toEqual({});
  });
});
