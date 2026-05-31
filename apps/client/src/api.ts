import { createRpcClient } from "@bsk/rpc/client";
import { rsa } from "@bsk/crypto";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { ServiceRouter } from "server";
import type { TtpRouter } from "ttp";

const ttpBaseUrl = import.meta.env.VITE_TTP_API_BASE_URL ?? "http://localhost:3001";
const serviceBaseUrl = import.meta.env.VITE_SERVICE_API_BASE_URL ?? "http://localhost:3002";

export const ttp = createRpcClient<TtpRouter>(ttpBaseUrl);
export const service = createRpcClient<ServiceRouter>(serviceBaseUrl);
export const ttpQuery = createTanstackQueryUtils(ttp);
export const serviceQuery = createTanstackQueryUtils(service);

type PrincipalPublicKeys = {
  authPublicKeyPem: string;
  exchangePublicKeyPem: string;
};

export type UserAuthenticationRequest = {
  userId: string;
  userCertificatePem: string;
  serverId: string;
  serverCertificatePem: string;
  requestId: string;
};

export const ttpProtocol = {
  async registerUser(id: string, publicKeys: PrincipalPublicKeys) {
    return ttp.register({
      role: "user",
      encryptedId: await encryptForTtp(id),
      publicKeys,
    });
  },

  async authenticateUser(request: UserAuthenticationRequest) {
    return ttp.auth.user({
      encryptedAuthMaterial: await encryptJsonForTtp(request),
    });
  },

  closeSession(sessionId: string) {
    return ttp.session.close({ sessionId });
  },
};

async function loadTtpPublicKey() {
  return rsa.publicKey((await ttp.publicKey()).publicKeyPem);
}

async function encryptForTtp(plaintext: string) {
  return (await loadTtpPublicKey()).encrypt(plaintext);
}

async function encryptJsonForTtp(value: object) {
  return (await loadTtpPublicKey()).encryptHybrid(JSON.stringify(value));
}
