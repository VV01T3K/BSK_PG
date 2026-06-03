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
import { log } from "./state";

function reject(code: "BAD_REQUEST" | "UNAUTHORIZED" | "NOT_FOUND", error: unknown): never {
  const message = error instanceof Error ? error.message : "Unknown TTP error";
  log("ttp", "request rejected", message, "warn");
  throw new ORPCError(code, { message });
}

export const ttpRouter = {
  publicKey: os.handler(() => ({
    ...ttpPublicKeyResponse(),
    algorithm: "RSA-4096-OAEP-SHA256 + AES-256-GCM",
    keyLength: RSA_BITS,
  })),

  register: os.input(type<RegisterIdentityInput>()).handler(({ input }) => {
    try {
      const registration = registerIdentity(input);
      log(input.role, "registered with TTP", `${input.role}:${registration.subjectId}`);
      return registration;
    } catch (error) {
      reject("BAD_REQUEST", error);
    }
  }),

  auth: {
    server: os.input(type<ServerAuthenticationInput>()).handler(({ input }) => {
      try {
        const response = authenticateServerCertificate(input);
        log("server", "server certificate validated", `request ${input.requestId}`);
        return response;
      } catch (error) {
        reject("UNAUTHORIZED", error);
      }
    }),

    redirect: os.input(type<UserAuthRedirectInput>()).handler(({ input }) => {
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

    user: os.input(type<UserAuthenticationInput>()).handler(({ input }) => {
      try {
        const { request, response } = authenticateUserForServer(input);
        log(
          "ttp",
          "session key issued",
          `session ${response.sessionId} for request ${request.requestId}`,
        );
        return response;
      } catch (error) {
        reject("UNAUTHORIZED", error);
      }
    }),
  },

  session: {
    serverKey: os.input(type<ServerSessionKeyInput>()).handler(({ input }) => {
      try {
        const response = serverSessionKey(input);
        log("ttp", "server session key fetched", `request ${input.requestId}`);
        return response;
      } catch (error) {
        reject("NOT_FOUND", error);
      }
    }),

    close: os.input(type<{ sessionId: string }>()).handler(({ input }) => {
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
