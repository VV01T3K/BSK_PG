import { Hono } from "hono";
import { cors } from "hono/cors";
import { issueCertificate, validateCertificate } from "./certificates.js";
import { ca, decryptHybridWithTtpPrivateKey, decryptWithTtpPrivateKey, encryptForPublicKey, newRandomHex, newSessionKey, RSA_BITS } from "./crypto.js";
import { log, logs, principalKey, principals, resetTtpStateForTests, sessions } from "./state.js";
import type {
  RegisterRequest,
  RegisterResponse,
  ServerAuthRequest,
  ServerAuthResponse,
  SessionCloseRequest,
  UserAuthMaterial,
  UserAuthRequest,
  UserAuthResponse,
} from "./types.js";

const SESSION_TTL_MS = 15 * 60 * 1000;

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown TTP error";
  log("ttp", "request rejected", message, "warn");
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
  .get("/", (c) => c.text("BSK PG Trusted Third Party"))
  .get("/api/health", (c) => {
    return c.json({
      ok: true,
      service: "ttp",
      registeredPrincipals: principals.size,
      activeSessions: [...sessions.values()].filter((session) => !session.closedAt).length,
    });
  })
  .get("/api/ttp/public-key", (c) => {
    return c.json({
      publicKeyPem: ca.publicKeyPem,
      certificatePem: ca.certificatePem,
      algorithm: "RSA-OAEP-SHA256",
      keyLength: RSA_BITS,
    });
  })
  .get("/api/logs", (c) => c.json({ logs }))
  .post("/api/reset", (c) => {
    resetTtpStateForTests();
    log("ttp", "authority reset", "cleared principals and sessions");
    return c.json({ ok: true, registeredPrincipals: 0, activeSessions: 0 });
  })
  .post("/api/register", async (c) => {
    try {
      const payload = (await c.req.json()) as RegisterRequest;
      if (payload.role !== "user" && payload.role !== "server") {
        throw new Error("role must be user or server");
      }

      const subjectId = decryptWithTtpPrivateKey(payload.encryptedId);
      const issuedAt = new Date().toISOString();
      const certificatePem = issueCertificate(payload.role, subjectId, payload.publicKeys.exchangePublicKeyPem);

      principals.set(principalKey(payload.role, subjectId), {
        role: payload.role,
        subjectId,
        publicKeys: payload.publicKeys,
        certificatePem,
        issuedAt,
      });

      log(payload.role, "registered with TTP", `${payload.role}:${subjectId}`);

      const response: RegisterResponse = { certificatePem, subjectId, issuedAt };
      return c.json(response);
    } catch (error) {
      return c.json(errorResponse(error), 400);
    }
  })
  .post("/api/auth/server", async (c) => {
    try {
      const payload = (await c.req.json()) as ServerAuthRequest;
      validateCertificate("server", payload.serverId, payload.certificatePem);
      const response: ServerAuthResponse = {
        ok: true,
        requestId: payload.requestId,
        serverId: payload.serverId,
        validatedAt: new Date().toISOString(),
      };
      log("server", "server certificate validated", `request ${payload.requestId}`);
      return c.json(response);
    } catch (error) {
      return c.json(errorResponse(error), 401);
    }
  })
  .post("/api/auth/user", async (c) => {
    try {
      const payload = (await c.req.json()) as UserAuthRequest;
      const material = JSON.parse(decryptHybridWithTtpPrivateKey(payload.encryptedAuthMaterial)) as UserAuthMaterial;
      const user = validateCertificate("user", material.userId, material.userCertificatePem);
      const server = validateCertificate("server", material.serverId, material.serverCertificatePem);

      const sessionId = newRandomHex(16);
      const sessionKey = newSessionKey();
      const createdAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

      sessions.set(sessionId, {
        sessionId,
        userId: user.subjectId,
        serverId: server.subjectId,
        sessionKey,
        createdAt,
        expiresAt,
      });

      log("ttp", "session key issued", `session ${sessionId} for request ${material.requestId}`);

      const encryptedSessionKeyForUser = encryptForPublicKey(user.publicKeys.exchangePublicKeyPem, {
        sessionId,
        sessionKey,
      });
      const encryptedSessionKeyForServer = encryptForPublicKey(server.publicKeys.exchangePublicKeyPem, {
        sessionId,
        sessionKey,
      });

      const response: UserAuthResponse = {
        ok: true,
        sessionId,
        encryptedSessionKeyForUser,
        encryptedSessionKeyForServer,
        expiresAt,
      };
      return c.json(response);
    } catch (error) {
      return c.json(errorResponse(error), 401);
    }
  })
  .post("/api/session/close", async (c) => {
    try {
      const payload = (await c.req.json()) as SessionCloseRequest;
      const session = sessions.get(payload.sessionId);
      if (!session) {
        throw new Error(`session ${payload.sessionId} not found`);
      }
      session.closedAt = new Date().toISOString();
      log("ttp", "session closed", payload.sessionId);
      return c.json({ ok: true, sessionId: payload.sessionId, closedAt: session.closedAt });
    } catch (error) {
      return c.json(errorResponse(error), 404);
    }
  });
