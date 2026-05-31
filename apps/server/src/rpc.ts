import { randomUUID } from "node:crypto";
import {
  aesGcm,
  hash,
  rsa,
  type SessionTicket,
} from "@bsk/crypto";
import { createRpcClient } from "@bsk/rpc/client";
import { ORPCError, os, type } from "@orpc/server";
import { log, readLogs, requireRegisteredServer, requireSessionKey, resetServiceServerStateForTests, snapshot, state } from "./state.js";
import type { EncryptedEnvelope, ServiceServerSnapshot } from "./types.js";
import type { TtpRouter } from "ttp";

const ttp = createRpcClient<TtpRouter>(process.env.TTP_API_BASE_URL ?? "http://localhost:3001");

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

  state: os.handler(() => snapshot()),

  logs: os.handler(() => ({ logs: readLogs() })),

  reset: os.handler(() => {
    resetServiceServerStateForTests();
    log("server reset", "cleared protected service server state");
    return snapshot();
  }),

  server: {
    register: os.handler(async (): Promise<ServiceServerSnapshot> => {
      try {
        const ttpPublicKeyPem = (await ttp.publicKey()).publicKeyPem;
        const serverId = hash.of(`server-${randomUUID()}`).sha256Hex();
        const authKeyPair = rsa.generatePair();
        const exchangeKeyPair = rsa.generatePair();
        const registration = await ttp.register({
          role: "server",
          encryptedId: rsa.publicKey(ttpPublicKeyPem).encrypt(serverId),
          publicKeys: {
            authPublicKeyPem: authKeyPair.publicKeyPem,
            exchangePublicKeyPem: exchangeKeyPair.publicKeyPem,
          },
        });

        state.serverId = registration.subjectId;
        state.exchangeKeyPair = exchangeKeyPair;
        state.certificatePem = registration.certificatePem;
        state.issuedAt = registration.issuedAt;
        state.sessionId = undefined;
        state.sessionKey = undefined;
        state.sessionExpiresAt = undefined;

        log("registered with TTP", `certificate ${snapshot().certificateFingerprint}`);
        return snapshot();
      } catch (error) {
        reject("BAD_REQUEST", error);
      }
    }),

    authenticate: os.input(type<{ requestId?: string } | undefined>()).handler(async ({ input }) => {
      try {
        requireRegisteredServer();
        const requestId = input?.requestId ?? randomUUID();
        const response = await ttp.auth.server({
          serverId: state.serverId!,
          certificatePem: state.certificatePem!,
          requestId,
        });
        log("server certificate authenticated", `request ${response.requestId}`);
        return { ...response, certificatePem: state.certificatePem };
      } catch (error) {
        reject("UNAUTHORIZED", error);
      }
    }),

    acceptSession: os
      .input(
        type<{
          sessionId: string;
          encryptedSessionKeyForServer: string;
          expiresAt: string;
        }>(),
      )
      .handler(({ input }) => {
        try {
          requireRegisteredServer();
          const ticket = JSON.parse(
            rsa
              .privateKey(state.exchangeKeyPair!.privateKeyPem)
              .decrypt(input.encryptedSessionKeyForServer),
          ) as SessionTicket;
          if (ticket.sessionId !== input.sessionId) {
            throw new Error("session key envelope does not match session id");
          }
          state.sessionId = ticket.sessionId;
          state.sessionKey = ticket.sessionKey;
          state.sessionExpiresAt = input.expiresAt;
          log("session key accepted", `session ${input.sessionId}`);
          return snapshot();
        } catch (error) {
          reject("BAD_REQUEST", error);
        }
      }),

    closeSession: os.handler(() => {
      const closedSession = state.sessionId;
      state.sessionId = undefined;
      state.sessionKey = undefined;
      state.sessionExpiresAt = undefined;
      log("session closed locally", closedSession ?? "no active session");
      return snapshot();
    }),
  },

  service: {
    exchange: os.input(type<{ envelope: EncryptedEnvelope }>()).handler(({ input }) => {
      try {
        const sessionKey = requireSessionKey();
        const sessionCipher = aesGcm.withKey(sessionKey).forSession(state.sessionId!);
        const plaintext = sessionCipher.decrypt(input.envelope);
        const responsePlaintext = `Protected service accepted encrypted request: ${plaintext}`;
        const encryptedResponse = sessionCipher.encrypt(responsePlaintext);

        state.lastPlainRequest = plaintext;
        state.lastPlainResponse = responsePlaintext;
        state.lastEncryptedRequest = input.envelope;
        state.lastEncryptedResponse = encryptedResponse;
        log("encrypted service exchange", `session ${state.sessionId}`);

        return {
          plaintextReceived: plaintext,
          plaintextResponse: responsePlaintext,
          envelope: encryptedResponse,
        };
      } catch (error) {
        reject("BAD_REQUEST", error);
      }
    }),
  },
};

export type ServiceRouter = typeof serviceRouter;
