import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { decryptAesGcm, decryptWithPrivateKey, encryptAesGcm, encryptForTtp, fingerprint, generateRsaPair, sha256 } from "./crypto.js";
import { authenticateServerWithTtp, getTtpPublicKey, registerWithTtp } from "./ttp-client.js";
import { log, logs, requireRegisteredServer, requireSessionKey, resetServiceServerStateForTests, snapshot, state } from "./state.js";
import type { EncryptedEnvelope } from "./types.js";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown service server error";
  log("request rejected", message, "warn");
  return { ok: false as const, error: message };
}

export const app = new Hono()
  .use(
    "/api/*",
    cors({
      origin: "*",
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type"],
    }),
  )
  .get("/", (c) => c.text("BSK PG protected service server"))
  .get("/api/health", (c) =>
    c.json({
      ok: true,
      service: "server",
      registered: Boolean(state.serverId),
      sessionEstablished: Boolean(state.sessionId),
    }),
  )
  .get("/api/server/state", (c) => c.json(snapshot()))
  .get("/api/logs", (c) => c.json({ logs }))
  .post("/api/reset", (c) => {
    resetServiceServerStateForTests();
    log("server reset", "cleared protected service server state");
    return c.json(snapshot());
  })
  .post("/api/server/register", async (c) => {
    try {
      const ttpPublicKeyPem = await getTtpPublicKey();
      const rawIdSeed = `server-${randomUUID()}`;
      const serverId = sha256(rawIdSeed);
      const authKeyPair = generateRsaPair();
      const exchangeKeyPair = generateRsaPair();
      const registration = await registerWithTtp({
        role: "server",
        encryptedId: encryptForTtp(ttpPublicKeyPem, serverId),
        publicKeys: {
          authPublicKeyPem: authKeyPair.publicKeyPem,
          exchangePublicKeyPem: exchangeKeyPair.publicKeyPem,
        },
      });

      state.serverId = registration.subjectId;
      state.rawIdSeed = rawIdSeed;
      state.authKeyPair = authKeyPair;
      state.exchangeKeyPair = exchangeKeyPair;
      state.certificatePem = registration.certificatePem;
      state.issuedAt = registration.issuedAt;
      state.sessionId = undefined;
      state.sessionKey = undefined;
      state.sessionExpiresAt = undefined;

      log("registered with TTP", `certificate ${fingerprint(registration.certificatePem)}`);
      return c.json(snapshot());
    } catch (error) {
      return c.json(errorResponse(error), 400);
    }
  })
  .post("/api/server/authenticate", async (c) => {
    try {
      requireRegisteredServer();
      const payload = (await c.req.json().catch(() => ({}))) as { requestId?: string };
      const requestId = payload.requestId ?? randomUUID();
      const response = await authenticateServerWithTtp({
        serverId: state.serverId!,
        certificatePem: state.certificatePem!,
        requestId,
      });
      log("server certificate authenticated", `request ${response.requestId}`);
      return c.json({ ...response, certificatePem: state.certificatePem });
    } catch (error) {
      return c.json(errorResponse(error), 401);
    }
  })
  .post("/api/server/accept-session", async (c) => {
    try {
      requireRegisteredServer();
      const payload = (await c.req.json()) as {
        sessionId: string;
        encryptedSessionKeyForServer: string;
        expiresAt: string;
      };
      const decrypted = JSON.parse(
        decryptWithPrivateKey(state.exchangeKeyPair!.privateKeyPem, payload.encryptedSessionKeyForServer),
      ) as { sessionId: string; sessionKey: string };
      if (decrypted.sessionId !== payload.sessionId) {
        throw new Error("session key envelope does not match session id");
      }
      state.sessionId = payload.sessionId;
      state.sessionKey = decrypted.sessionKey;
      state.sessionExpiresAt = payload.expiresAt;
      log("session key accepted", `session ${payload.sessionId}`);
      return c.json(snapshot());
    } catch (error) {
      return c.json(errorResponse(error), 400);
    }
  })
  .post("/api/service/exchange", async (c) => {
    try {
      const sessionKey = requireSessionKey();
      const payload = (await c.req.json()) as { envelope: EncryptedEnvelope };
      if (payload.envelope.sessionId !== state.sessionId) {
        throw new Error("encrypted envelope session id does not match active session");
      }
      const plaintext = decryptAesGcm(sessionKey, payload.envelope);
      const responsePlaintext = `Protected service accepted encrypted request: ${plaintext}`;
      const encryptedResponse = encryptAesGcm(state.sessionId!, sessionKey, responsePlaintext);

      state.lastPlainRequest = plaintext;
      state.lastPlainResponse = responsePlaintext;
      state.lastEncryptedRequest = payload.envelope;
      state.lastEncryptedResponse = encryptedResponse;
      log("encrypted service exchange", `session ${state.sessionId}`);

      return c.json({
        plaintextReceived: plaintext,
        plaintextResponse: responsePlaintext,
        envelope: encryptedResponse,
      });
    } catch (error) {
      return c.json(errorResponse(error), 400);
    }
  })
  .post("/api/server/session/close", (c) => {
    const closedSession = state.sessionId;
    state.sessionId = undefined;
    state.sessionKey = undefined;
    state.sessionExpiresAt = undefined;
    log("session closed locally", closedSession ?? "no active session");
    return c.json(snapshot());
  });
