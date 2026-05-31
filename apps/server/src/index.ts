import { createRpcFetch } from "@bsk/rpc/server";

import { serviceRouter } from "./rpc.js";

export { serviceRouter } from "./rpc.js";
export { resetServiceServerStateForTests } from "./state.js";
export type { EncryptedEnvelope, ServiceServerSnapshot } from "./types.js";
export type { ServiceRouter } from "./rpc.js";

export const fetch = createRpcFetch(serviceRouter, "BSK PG protected service server");

export default {
  port: 3002,
  fetch,
};
