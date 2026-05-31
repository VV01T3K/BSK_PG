import { ORPCError, os, type } from "@orpc/server";
import { log, readLogs, readServiceServerStatus, requireRegisteredServer, resetServiceServerStateForTests, state } from "./state";
import {
  acceptSessionTicket,
  authenticateProtectedServer,
  closeLocalSession,
  exchangeProtectedServiceData,
  registerProtectedServer,
  type AcceptSessionInput,
} from "./protocol";
import type { SessionEncryptedPayload, ServiceServerStatus } from "./types";

function reject(code: "BAD_REQUEST" | "UNAUTHORIZED", error: unknown): never {
  const message = error instanceof Error ? error.message : "Unknown service server error";
  log("request rejected", message, "warn");
  throw new ORPCError(code, { message });
}

export const serviceRouter = {
  health: os.handler(() => ({
    ok: true,
    service: "server",
    registered: Boolean(state.serverId),
    sessionEstablished: Boolean(state.sessionId),
  })),

  state: os.handler(() => readServiceServerStatus()),

  logs: os.handler(() => ({ logs: readLogs() })),

  reset: os.handler(() => {
    resetServiceServerStateForTests();
    log("server reset", "cleared protected service server state");
    return readServiceServerStatus();
  }),

  server: {
    register: os.handler(async (): Promise<ServiceServerStatus> => {
      try {
        const server = await registerProtectedServer();
        log("registered with TTP", `server ${server.serverId}`);
        return server;
      } catch (error) {
        reject("BAD_REQUEST", error);
      }
    }),

    authenticate: os.input(type<{ requestId?: string } | undefined>()).handler(async ({ input }) => {
      try {
        requireRegisteredServer();
        const response = await authenticateProtectedServer(input?.requestId);
        log("server certificate authenticated", `request ${response.requestId}`);
        return response;
      } catch (error) {
        reject("UNAUTHORIZED", error);
      }
    }),

    acceptSession: os
      .input(type<AcceptSessionInput>())
      .handler(({ input }) => {
        try {
          const server = acceptSessionTicket(input);
          log("session key accepted", `session ${input.sessionId}`);
          return server;
        } catch (error) {
          reject("BAD_REQUEST", error);
        }
      }),

    closeSession: os.handler(() => {
      const { closedSession, serverStatus } = closeLocalSession();
      log("session closed locally", closedSession ?? "no active session");
      return serverStatus;
    }),
  },

  service: {
    exchange: os.input(type<{ payload: SessionEncryptedPayload }>()).handler(({ input }) => {
      try {
        const response = exchangeProtectedServiceData(input.payload);
        log("encrypted service exchange", `session ${state.sessionId}`);
        return response;
      } catch (error) {
        reject("BAD_REQUEST", error);
      }
    }),
  },
};

export type ServiceRouter = typeof serviceRouter;
