import { RSA_BITS } from "@bsk/crypto";
import { ORPCError, os, type } from "@orpc/server";

import type {
  RegisterIdentityInput,
  ServerAuthenticationInput,
  ServerSessionKeyInput,
  UserAuthenticationInput,
  UserAuthRedirectInput,
} from "./contract";
import {
  authenticateServerCertificate,
  authenticateUserForServer,
  closeSession,
  registerIdentity,
  requestUserAuthentication,
  serverSessionKey,
  ttpPublicKeyResponse,
} from "./protocol";
import { artifact, log } from "./state";

function reject(code: "BAD_REQUEST" | "UNAUTHORIZED" | "NOT_FOUND", error: unknown): never {
  const message = error instanceof Error ? error.message : "Unknown TTP error";
  log("ttp", "request rejected", message, "warn");
  throw new ORPCError(code, { message });
}

export const ttpRouter = {
  publicKey: os.handler(async () => {
    log("ttp", "public key requested", "authority public key");
    return {
      ...(await ttpPublicKeyResponse()),
      algorithm: "RSA-4096-OAEP-SHA256 + AES-256-GCM",
      keyLength: RSA_BITS,
    };
  }),

  register: os.input(type<RegisterIdentityInput>()).handler(async ({ input }) => {
    log(input.role, "registration request received", `${input.role} encrypted id`);
    try {
      const registration = await registerIdentity(input);
      log(input.role, "registered with TTP", `${input.role}:${registration.subjectId}`);
      return registration;
    } catch (error) {
      reject("BAD_REQUEST", error);
    }
  }),

  auth: {
    server: os.input(type<ServerAuthenticationInput>()).handler(async ({ input }) => {
      log(
        "server",
        "server authentication request received",
        `request ${input.requestId} for user ${input.userId}`,
      );
      try {
        const response = authenticateServerCertificate(input);
        log("server", "server certificate validated", `request ${input.requestId}`);
        return response;
      } catch (error) {
        await artifact("ttp", `ttp/rejections/server-auth-${input.requestId}.json`, {
          kind: "server-auth",
          requestId: input.requestId,
          rejectedAt: new Date().toISOString(),
          error: error instanceof Error ? { name: error.name, message: error.message } : error,
        });
        reject("UNAUTHORIZED", error);
      }
    }),

    redirect: os.input(type<UserAuthRedirectInput>()).handler(({ input }) => {
      log("ttp", "user authentication redirect requested", `request ${input.requestId}`);
      try {
        const response = requestUserAuthentication(input);
        log(
          "ttp",
          "user authentication requested",
          `redirect to user for request ${input.requestId}`,
        );
        return response;
      } catch (error) {
        reject("UNAUTHORIZED", error);
      }
    }),

    user: os.input(type<UserAuthenticationInput>()).handler(async ({ input }) => {
      log(
        "user",
        "user authentication request received",
        `encrypted material ${input.encryptedAuthMaterial.length} chars`,
      );
      try {
        const { request, response } = await authenticateUserForServer(input);
        log(
          "ttp",
          "session key issued",
          `session ${response.sessionId} for request ${request.requestId}`,
        );
        return response;
      } catch (error) {
        await artifact("ttp", "ttp/rejections/user-auth-encrypted-request.json", {
          kind: "user-auth",
          requestId: "encrypted-request",
          rejectedAt: new Date().toISOString(),
          error: error instanceof Error ? { name: error.name, message: error.message } : error,
        });
        reject("UNAUTHORIZED", error);
      }
    }),
  },

  session: {
    serverKey: os.input(type<ServerSessionKeyInput>()).handler(({ input }) => {
      log("server", "server session key request received", `request ${input.requestId}`);
      try {
        const response = serverSessionKey(input);
        log("ttp", "server session key fetched", `request ${input.requestId}`);
        return response;
      } catch (error) {
        reject("NOT_FOUND", error);
      }
    }),

    close: os.input(type<{ sessionId: string }>()).handler(({ input }) => {
      log("ttp", "session close requested", input.sessionId);
      try {
        const response = closeSession(input.sessionId);
        log("ttp", "session closed", input.sessionId);
        return response;
      } catch (error) {
        reject("NOT_FOUND", error);
      }
    }),
  },
};

export type TtpRouter = typeof ttpRouter;
