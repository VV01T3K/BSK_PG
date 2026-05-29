import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { app as serviceApp, resetServiceServerStateForTests } from "server";
import { app as ttpApp, resetTtpStateForTests } from "ttp";
import {
  authenticateSecurityDemoSession,
  exchangeEncryptedServiceMessage,
  registerSecurityDemoRoles,
  resetSecurityDemo,
  runForgedCertificateAttack,
  runMitmTamperAttack,
} from "./actions";

const originalFetch = globalThis.fetch;

function requestPath(input: RequestInfo | URL): string {
  if (input instanceof Request) {
    const url = new URL(input.url);
    return `${url.pathname}${url.search}`;
  }
  const url = new URL(input.toString());
  return `${url.pathname}${url.search}`;
}

function requestInit(input: RequestInfo | URL, init?: RequestInit): RequestInit | undefined {
  if (!(input instanceof Request)) {
    return init;
  }
  return {
    method: input.method,
    headers: input.headers,
    body: input.body,
    ...init,
  };
}

describe("browser-style Client security flow", () => {
  beforeEach(async () => {
    resetTtpStateForTests();
    resetServiceServerStateForTests();
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? new URL(input.url) : new URL(input.toString());
      if (url.host === "localhost:3001") {
        return ttpApp.request(requestPath(input), requestInit(input, init));
      }
      if (url.host === "localhost:3002") {
        return serviceApp.request(requestPath(input), requestInit(input, init));
      }
      return originalFetch(input, init);
    }) as typeof fetch;
    await resetSecurityDemo();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("registers, authenticates, exchanges encrypted service data, and rejects attacks", async () => {
    let snapshot = await registerSecurityDemoRoles();
    expect(snapshot.userRegistered).toBe(true);
    expect(snapshot.serverRegistered).toBe(true);

    snapshot = await authenticateSecurityDemoSession();
    expect(snapshot.sessionEstablished).toBe(true);
    expect(snapshot.sessionId).toBeTruthy();

    snapshot = await exchangeEncryptedServiceMessage();
    expect(snapshot.lastPlainRequest).toContain("protected grade-summary service");
    expect(snapshot.lastPlainResponse).toContain("Protected service accepted encrypted request");
    expect(snapshot.lastEncryptedRequest?.ciphertext).toBeTruthy();
    expect(snapshot.lastEncryptedResponse?.ciphertext).toBeTruthy();

    snapshot = await runForgedCertificateAttack();
    expect(snapshot.forgedCertificateRejected).toBe(true);

    snapshot = await runMitmTamperAttack();
    expect(snapshot.mitmRejected).toBe(true);
  });
});
