import { hc, type InferResponseType } from "hono/client";
import type { TtpApp } from "../../../../ttp/src/index.ts";

const ttpApiBaseUrl = import.meta.env.VITE_TTP_API_BASE_URL ?? "http://localhost:3001";

export const ttpClient = hc<TtpApp>(ttpApiBaseUrl);

type UsersResponse = InferResponseType<typeof ttpClient.api.users.$get, 200>;
export type HonoUser = UsersResponse["users"][number];

export async function getHonoUsers(): Promise<HonoUser[]> {
  const response = await ttpClient.api.users.$get();

  if (!response.ok) {
    throw new Error(`Hono request failed with status ${response.status}`);
  }

  const payload: UsersResponse = await response.json();
  return payload.users;
}
