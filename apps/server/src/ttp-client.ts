import { hc } from "hono/client";
import type { RegisterRequest, RegisterResponse, ServerAuthRequest, ServerAuthResponse, TtpApp } from "ttp";

function ttpBaseUrl(): string {
  return process.env.TTP_API_BASE_URL ?? "http://localhost:3001";
}

const ttpClient = hc<TtpApp>(ttpBaseUrl());

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json();
  if (!response.ok) {
    const message = typeof payload?.error === "string" ? payload.error : `TTP request failed with ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}

export async function getTtpPublicKey(): Promise<string> {
  const response = await ttpClient.api.ttp["public-key"].$get();
  const payload = await parseResponse<{ publicKeyPem: string }>(response);
  return payload.publicKeyPem;
}

export async function registerWithTtp(payload: RegisterRequest): Promise<RegisterResponse> {
  const response = await ttpClient.api.register.$post({ json: payload });
  return parseResponse<RegisterResponse>(response);
}

export async function authenticateServerWithTtp(payload: ServerAuthRequest): Promise<ServerAuthResponse> {
  const response = await ttpClient.api.auth.server.$post({ json: payload });
  return parseResponse<ServerAuthResponse>(response);
}
