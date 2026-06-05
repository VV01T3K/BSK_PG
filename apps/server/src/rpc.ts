import type { SessionEncryptedPayload } from "@bsk/crypto";
import { ORPCError, os, type } from "@orpc/server";

import {
  closeLocalSession,
  exchangeProtectedServiceData,
  fetchServerSessionKey,
  registerProtectedServer,
  requestService,
} from "./protocol";
import { log, readServiceServerStatus, resetServiceServerState, state } from "./state";
import type { ServiceServerStatus } from "./state";

function reject(code: "BAD_REQUEST" | "UNAUTHORIZED", error: unknown): never {
  const message = error instanceof Error ? error.message : "Unknown service server error";
  log("request rejected", message, "warn");
  throw new ORPCError(code, { message });
}

export const serviceRouter = {
  state: os.handler(() => readServiceServerStatus()),

  requestService: os.input(type<{ userId: string }>()).handler(async ({ input }) => {
    log("service request received", `user ${input.userId}`);
    try {
      const response = await requestService(input);
      log("service requested", `request ${response.requestId} for user ${input.userId}`);
      return response;
    } catch (error) {
      reject("UNAUTHORIZED", error);
    }
  }),

  reset: os.handler(() => {
    resetServiceServerState();
    log("reset requested", "clearing protected service server state");
    log("server reset", "cleared protected service server state");
    return readServiceServerStatus();
  }),

  server: {
    register: os.handler(async (): Promise<ServiceServerStatus> => {
      log("server registration requested", "registering with TTP");
      try {
        const server = await registerProtectedServer();
        log("registered with TTP", `server ${server.serverId}`);
        return server;
      } catch (error) {
        reject("BAD_REQUEST", error);
      }
    }),

    fetchKey: os.input(type<{ requestId: string }>()).handler(async ({ input }) => {
      log("session key fetch requested", `request ${input.requestId}`);
      try {
        const server = await fetchServerSessionKey(input);
        log("session key fetched from TTP", `request ${input.requestId}`);
        return server;
      } catch (error) {
        reject("BAD_REQUEST", error);
      }
    }),

    closeSession: os.handler(() => {
      log("session close requested", state.sessionId ?? "no active session");
      const { closedSession, serverStatus } = closeLocalSession();
      log("session closed locally", closedSession ?? "no active session");
      return serverStatus;
    }),
  },

  service: {
    exchange: os.input(type<{ payload: SessionEncryptedPayload }>()).handler(({ input }) => {
      log("protected service request received", `session ${input.payload.sessionId}`);
      try {
        const response = exchangeProtectedServiceData(input.payload);
        const event = state.lastServiceEvent;
        log(
          event?.event ?? "demo file service used",
          event ? `${event.details}, session ${state.sessionId}` : `session ${state.sessionId}`,
        );
        return response;
      } catch (error) {
        reject("BAD_REQUEST", error);
      }
    }),
  },
};

export type ServiceRouter = typeof serviceRouter;
