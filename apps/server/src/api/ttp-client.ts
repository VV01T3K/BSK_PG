import { hc, type InferResponseType } from "hono/client";
import type { TtpApp } from "ttp";
import { env } from "#/env";

const ttpApiBaseUrl = env.VITE_TTP_API_BASE_URL;

export const ttpClient = hc<TtpApp>(ttpApiBaseUrl);

type StartupResponse = InferResponseType<typeof ttpClient.api.startup.$get, 200>;
type ProductsResponse = InferResponseType<typeof ttpClient.api.products.$get, 200>;
export type HonoProduct = ProductsResponse["products"][number];

export async function getAppStartupStatus(): Promise<StartupResponse> {
  const response = await ttpClient.api.startup.$get();

  if (!response.ok) {
    throw new Error(`Startup request failed with status ${response.status}`);
  }

  return response.json();
}

export async function getHonoProducts(): Promise<HonoProduct[]> {
  const response = await ttpClient.api.products.$get();

  if (!response.ok) {
    throw new Error(`Hono request failed with status ${response.status}`);
  }

  const payload: ProductsResponse = await response.json();
  return payload.products;
}
