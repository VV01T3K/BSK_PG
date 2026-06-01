import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { serviceQuery } from "#/api";

import { clientSecurityState } from "./client-security-state";
import { securityFlow } from "./security-flow";

const CLIENT_STATUS_KEY = ["client-status"] as const;

/** React adapter for the security flow page: queries current state and exposes protocol steps as mutations. */
export function useSecurityFlow() {
  const queryClient = useQueryClient();
  const serverQuery = useQuery(serviceQuery.state.queryOptions());
  const clientStatusQuery = useQuery({
    queryKey: CLIENT_STATUS_KEY,
    queryFn: () => clientSecurityState.readPublicStatus(),
  });

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: serviceQuery.state.key() }),
      queryClient.invalidateQueries({ queryKey: CLIENT_STATUS_KEY }),
    ]);

  const forged = useMutation({ mutationFn: securityFlow.verifyForgedCertificateIsRejected });
  const register = useMutation({
    mutationFn: securityFlow.registerPrincipals,
    onSuccess: invalidate,
  });
  const authenticate = useMutation({
    mutationFn: securityFlow.authenticateSession,
    onSuccess: invalidate,
  });
  const exchange = useMutation({
    mutationFn: securityFlow.sendEncryptedServiceRequest,
    onSuccess: invalidate,
  });
  const closeSession = useMutation({
    mutationFn: securityFlow.closeSession,
    onSuccess: invalidate,
  });
  const reset = useMutation({
    mutationFn: securityFlow.resetEnvironment,
    onSuccess: async () => {
      forged.reset();
      await invalidate();
    },
  });

  const mutations = [register, authenticate, exchange, forged, closeSession, reset];
  const server = serverQuery.data;
  const clientStatus = clientStatusQuery.data;

  return {
    clientStatus,
    server,
    register,
    authenticate,
    exchange,
    forged,
    closeSession,
    reset,
    busy: mutations.some((mutation) => mutation.isPending),
    error: mutations.find((mutation) => mutation.error)?.error as Error | undefined,
    serverRegistered: Boolean(server?.registered),
    registrationComplete: Boolean(clientStatus?.userRegistered && server?.registered),
    sessionEstablished: Boolean(clientStatus?.sessionId && server?.sessionEstablished),
    serviceExchanged: Boolean(server?.serviceExchanged),
  };
}
