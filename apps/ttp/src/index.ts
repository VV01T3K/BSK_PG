import { createRpcFetch } from "@bsk/rpc/server";

import { ttpRouter } from "./rpc";

export { ttpRouter } from "./rpc";
export type { PrincipalPublicKeys, UserAuthenticationRequest } from "./contract";
export type { TtpRouter } from "./rpc";

export const fetch = createRpcFetch(ttpRouter, "BSK PG Trusted Third Party");

export default {
  port: 3001,
  fetch,
};
