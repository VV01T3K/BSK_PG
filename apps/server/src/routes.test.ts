import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { app as ttpApp, resetTtpStateForTests } from "ttp";
import { encryptAesGcm } from "./crypto.js";
import { app, resetServiceServerStateForTests } from "./index.js";
import { state } from "./state.js";

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

async function registerServer(): Promise<void> {
  const response = await app.request("/api/server/register", { method: "POST" });
  expect(response.status).toBe(200);
}

describe("protected service server routes", () => {
  beforeEach(() => {
    resetTtpStateForTests();
    resetServiceServerStateForTests();
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? new URL(input.url) : new URL(input.toString());
      if (url.host === "localhost:3001") {
        return ttpApp.request(requestPath(input), requestInit(input, init));
      }
      return originalFetch(input, init);
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("rejects encrypted exchange without an active session", async () => {
    const response = await app.request("/api/service/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        envelope: {
          sessionId: "missing",
          iv: "aXY=",
          ciphertext: "YQ==",
          authTag: "dGFn",
        },
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false });
  });

  it("rejects accept-session when the envelope session id does not match", async () => {
    await registerServer();
    const response = await app.request("/api/server/accept-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "expected-session",
        encryptedSessionKeyForServer: Buffer.from("{}").toString("base64"),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false });
  });

  it("rejects encrypted exchange when the envelope session id mismatches", async () => {
    await registerServer();
    state.sessionId = "active-session";
    state.sessionKey = Buffer.alloc(32).toString("base64");
    state.sessionExpiresAt = new Date(Date.now() + 60_000).toISOString();

    const envelope = encryptAesGcm("other-session", state.sessionKey, "payload");
    const response = await app.request("/api/service/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ envelope }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: expect.stringContaining("session id"),
    });
  });

  it("rejects encrypted exchange after the session expires", async () => {
    await registerServer();
    state.sessionId = "expired-session";
    state.sessionKey = Buffer.alloc(32).toString("base64");
    state.sessionExpiresAt = new Date(Date.now() - 1_000).toISOString();

    const envelope = encryptAesGcm(state.sessionId, state.sessionKey, "payload");
    const response = await app.request("/api/service/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ envelope }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: expect.stringContaining("expired"),
    });
  });

  it("clears state on reset", async () => {
    await registerServer();
    const response = await app.request("/api/reset", { method: "POST" });
    expect(response.status).toBe(200);
    const snapshot = await response.json();
    expect(snapshot).toMatchObject({ registered: false, sessionEstablished: false });
  });
});
