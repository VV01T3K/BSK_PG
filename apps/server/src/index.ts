export { app } from "./routes.js";
export { resetServiceServerStateForTests } from "./state.js";
export type { EncryptedEnvelope, ServiceServerSnapshot } from "./types.js";

import { app } from "./routes.js";

export type ServiceServerApp = typeof app;

export default {
  port: 3002,
  fetch: app.fetch,
};
