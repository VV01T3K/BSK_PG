import {
  random,
  rsa,
  RSA_BITS,
  type SessionTicket,
} from "@bsk/crypto";
import { ORPCError, os, type } from "@orpc/server";
import { issueCertificate, validateCertificate } from "./certificates.js";
import { ca } from "./crypto.js";
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

type UserAuthMaterial = {
  userId: string;
  userCertificatePem: string;
  serverId: string;
  serverCertificatePem: string;
  requestId: string;
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
      const subjectId = rsa.privateKey(ca.privateKeyPem).decrypt(input.encryptedId);
      const issuedAt = new Date().toISOString();
      const principal = {
        role: input.role,
        subjectId,
        publicKeys: input.publicKeys,
      };
      const certificatePem = issueCertificate(principal);

      principals.set(principalKey(input.role, subjectId), {
        ...principal,
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
        validateCertificate({
          role: "server",
          subjectId: input.serverId,
          certificatePem: input.certificatePem,
        });
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
        const material = JSON.parse(
          rsa.privateKey(ca.privateKeyPem).decryptHybrid(input.encryptedAuthMaterial),
        ) as UserAuthMaterial;
        const user = validateCertificate({
          role: "user",
          subjectId: material.userId,
          certificatePem: material.userCertificatePem,
        });
        const server = validateCertificate({
          role: "server",
          subjectId: material.serverId,
          certificatePem: material.serverCertificatePem,
        });
        const ticket: SessionTicket = {
          sessionId: random.hex(16),
          sessionKey: random.sessionKey(),
        };
        const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

        sessions.set(ticket.sessionId, {
          sessionId: ticket.sessionId,
          userId: user.subjectId,
          serverId: server.subjectId,
          sessionKey: ticket.sessionKey,
          createdAt: new Date().toISOString(),
          expiresAt,
        });

        log("ttp", "session key issued", `session ${ticket.sessionId} for request ${material.requestId}`);

        const ticketPayload = JSON.stringify(ticket);
        return {
          ok: true as const,
          sessionId: ticket.sessionId,
          encryptedSessionKeyForUser: rsa
            .publicKey(user.publicKeys.exchangePublicKeyPem)
            .encrypt(ticketPayload),
          encryptedSessionKeyForServer: rsa
            .publicKey(server.publicKeys.exchangePublicKeyPem)
            .encrypt(ticketPayload),
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
