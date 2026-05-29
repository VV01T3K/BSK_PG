import { hc } from "hono/client";
import type { ServiceServerApp } from "server";
import type { TtpApp } from "ttp";

const ttpBaseUrl = import.meta.env.VITE_TTP_API_BASE_URL ?? "http://localhost:3001";
const serviceBaseUrl = import.meta.env.VITE_SERVICE_API_BASE_URL ?? "http://localhost:3002";

export const ttpClient = hc<TtpApp>(ttpBaseUrl);
export const serviceClient = hc<ServiceServerApp>(serviceBaseUrl);

export async function parseRpcResponse<T>(response: Response): Promise<T> {
  const payload = await response.json();
  if (!response.ok) {
    const message = typeof payload?.error === "string" ? payload.error : `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}

export interface TtpHealth {
  ok: boolean;
  service: string;
  registeredPrincipals: number;
  activeSessions: number;
}

export async function getTtpHealth(): Promise<TtpHealth> {
  const response = await ttpClient.api.health.$get();
  return parseRpcResponse<TtpHealth>(response);
}
