import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fetch as serviceFetch, resetServiceServerStateForTests } from "server";
import { fetch as ttpFetch, resetTtpStateForTests } from "ttp";
import { service } from "#/api";
import { securityFlow } from "../lib/security-flow";
import { clientIdentity } from "../lib/state";

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
    duplex: "half",
    ...init,
  } as RequestInit;
}

describe("browser-style Client security flow", () => {
  beforeEach(async () => {
    resetTtpStateForTests();
    resetServiceServerStateForTests();
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? new URL(input.url) : new URL(input.toString());
      if (url.host === "localhost:3001") {
        return ttpFetch(new Request(`http://localhost:3001${requestPath(input)}`, requestInit(input, init)));
      }
      if (url.host === "localhost:3002") {
        return serviceFetch(new Request(`http://localhost:3002${requestPath(input)}`, requestInit(input, init)));
      }
      return originalFetch(input, init);
    }) as typeof fetch;
    await securityFlow.resetEnvironment();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("registers, authenticates, exchanges encrypted service data, and rejects a forged certificate", async () => {
    await securityFlow.registerPrincipals();
    expect((await clientIdentity()).userRegistered).toBe(true);
    expect((await service.state()).registered).toBe(true);

    await securityFlow.authenticateSession();
    expect((await service.state()).sessionEstablished).toBe(true);
    expect((await clientIdentity()).sessionId).toBeTruthy();

    await securityFlow.sendEncryptedServiceRequest();
    const server = await service.state();
    expect(server.lastPlainRequest).toContain("protected grade-summary service");
    expect(server.lastPlainResponse).toContain("Protected service accepted encrypted request");
    expect(server.lastEncryptedRequest?.ciphertext).toBeTruthy();
    expect(server.lastEncryptedResponse?.ciphertext).toBeTruthy();

    const forgedResult = await securityFlow.verifyForgedCertificateIsRejected();
    expect(forgedResult.rejected).toBe(true);
    expect(forgedResult.message).not.toContain("unexpectedly accepted");
  });
});
