import { createRpcFetch } from "@bsk/rpc/server";

import { ttpRouter } from "./rpc.js";

export { ttpRouter } from "./rpc.js";
export { resetTtpStateForTests } from "./state.js";
export type { EventLogEntry } from "@bsk/rpc/log";
export type { TtpRouter } from "./rpc.js";

export const fetch = createRpcFetch(ttpRouter, "BSK PG Trusted Third Party");

export default {
  port: 3001,
  fetch,
};
