import { createRpcFetch } from "@bsk/rpc/server";

import { serviceRouter } from "./rpc";

export { serviceRouter } from "./rpc";
export { resetServiceServerStateForTests } from "./state";
export type { SessionEncryptedPayload, ServiceServerSnapshot } from "./types";
export type { ServiceRouter } from "./rpc";

export const fetch = createRpcFetch(serviceRouter, "BSK PG protected service server");

export default {
  port: 3002,
  fetch,
};
