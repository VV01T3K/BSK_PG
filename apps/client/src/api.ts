import { createRpcClient } from "@bsk/rpc/client";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { ServiceRouter } from "server";
import type { TtpRouter } from "ttp";

const ttpBaseUrl = import.meta.env.VITE_TTP_API_BASE_URL ?? "http://localhost:3001";
const serviceBaseUrl = import.meta.env.VITE_SERVICE_API_BASE_URL ?? "http://localhost:3002";

export const ttp = createRpcClient<TtpRouter>(ttpBaseUrl);
export const service = createRpcClient<ServiceRouter>(serviceBaseUrl);
export const ttpQuery = createTanstackQueryUtils(ttp);
export const serviceQuery = createTanstackQueryUtils(service);
