import { ORPCError, os, type } from "@orpc/server";
import { issueCertificate, validateCertificate } from "./certificates.js";
import { ca, decryptHybridWithTtpPrivateKey, decryptWithTtpPrivateKey, encryptForPublicKey, newRandomHex, newSessionKey, RSA_BITS } from "./crypto.js";
import { log, principalKey, principals, readLogs, sessions } from "./state.js";
import type { PrincipalRecord, Role } from "./types.js";

const SESSION_TTL_MS = 15 * 60 * 1000;

type RegisterInput = {
  role: Role;
  encryptedId: string;
  publicKeys: PrincipalRecord["publicKeys"];
};

type ServerAuthInput = {
  serverId: string;
  certificatePem: string;
  requestId: string;
};

type UserAuthInput = {
  encryptedAuthMaterial: string;
};

function reject(code: "BAD_REQUEST" | "UNAUTHORIZED" | "NOT_FOUND", error: unknown): never {
  const message = error instanceof Error ? error.message : "Unknown TTP error";
  log("ttp", "request rejected", message, "warn");
  throw new ORPCError(code, { message });
}

export const ttpRouter = {
  health: os.handler(() => ({
    ok: true,
    service: "ttp",
    registeredPrincipals: principals.size,
    activeSessions: [...sessions.values()].filter((session) => !session.closedAt).length,
  })),

  publicKey: os.handler(() => ({
    publicKeyPem: ca.publicKeyPem,
    certificatePem: ca.certificatePem,
    algorithm: "RSA-OAEP-SHA256",
    keyLength: RSA_BITS,
  })),

  logs: os.handler(() => ({ logs: readLogs() })),

  register: os.input(type<RegisterInput>()).handler(({ input }) => {
    try {
      if (input.role !== "user" && input.role !== "server") {
        throw new Error("role must be user or server");
      }

      const subjectId = decryptWithTtpPrivateKey(input.encryptedId);
      const issuedAt = new Date().toISOString();
      const certificatePem = issueCertificate(input.role, subjectId, input.publicKeys.exchangePublicKeyPem);

      principals.set(principalKey(input.role, subjectId), {
        role: input.role,
        subjectId,
        publicKeys: input.publicKeys,
        certificatePem,
        issuedAt,
      });

      log(input.role, "registered with TTP", `${input.role}:${subjectId}`);

      return { certificatePem, subjectId, issuedAt };
    } catch (error) {
      reject("BAD_REQUEST", error);
    }
  }),

  auth: {
    server: os.input(type<ServerAuthInput>()).handler(({ input }) => {
      try {
        validateCertificate("server", input.serverId, input.certificatePem);
        const response = {
          ok: true,
          requestId: input.requestId,
          serverId: input.serverId,
          validatedAt: new Date().toISOString(),
        } as const;
        log("server", "server certificate validated", `request ${input.requestId}`);
        return response;
      } catch (error) {
        reject("UNAUTHORIZED", error);
      }
    }),

    user: os.input(type<UserAuthInput>()).handler(({ input }) => {
      try {
        const material = JSON.parse(decryptHybridWithTtpPrivateKey(input.encryptedAuthMaterial)) as {
          userId: string;
          userCertificatePem: string;
          serverId: string;
          serverCertificatePem: string;
          requestId: string;
        };
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

        return {
          ok: true as const,
          sessionId,
          encryptedSessionKeyForUser,
          encryptedSessionKeyForServer,
          expiresAt,
        };
      } catch (error) {
        reject("UNAUTHORIZED", error);
      }
    }),
  },

  session: {
    close: os.input(type<{ sessionId: string }>()).handler(({ input }) => {
      try {
        const session = sessions.get(input.sessionId);
        if (!session) {
          throw new Error(`session ${input.sessionId} not found`);
        }
        session.closedAt = new Date().toISOString();
        log("ttp", "session closed", input.sessionId);
        return { ok: true, sessionId: input.sessionId, closedAt: session.closedAt };
      } catch (error) {
        reject("NOT_FOUND", error);
      }
    }),
  },
};

export type TtpRouter = typeof ttpRouter;
