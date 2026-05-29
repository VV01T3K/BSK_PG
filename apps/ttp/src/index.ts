export { app } from "./routes.js";
export { resetTtpStateForTests } from "./state.js";
export type {
  EventLogEntry,
  HybridEncryptedEnvelope,
  PublicKeySet,
  RegisterRequest,
  RegisterResponse,
  Role,
  ServerAuthRequest,
  ServerAuthResponse,
  SessionCloseRequest,
  UserAuthMaterial,
  UserAuthRequest,
  UserAuthResponse,
} from "./types.js";

import { app } from "./routes.js";

export type TtpApp = typeof app;

export default {
  port: 3001,
  fetch: app.fetch,
};
