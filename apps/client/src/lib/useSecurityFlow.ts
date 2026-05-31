import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { serviceQuery } from "#/api";
import { securityFlow } from "./security-flow";
import { clientIdentity } from "./state";

const CLIENT_IDENTITY_KEY = ["client-identity"] as const;

/** React adapter for the security flow page: queries current state and exposes protocol steps as mutations. */
export function useSecurityFlow() {
  const queryClient = useQueryClient();
  const serverQuery = useQuery(serviceQuery.state.queryOptions());
  const identityQuery = useQuery({ queryKey: CLIENT_IDENTITY_KEY, queryFn: clientIdentity });

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: serviceQuery.state.key() }),
      queryClient.invalidateQueries({ queryKey: CLIENT_IDENTITY_KEY }),
    ]);

  const forged = useMutation({ mutationFn: securityFlow.verifyForgedCertificateIsRejected });
  const register = useMutation({ mutationFn: securityFlow.registerPrincipals, onSuccess: invalidate });
  const authenticate = useMutation({ mutationFn: securityFlow.authenticateSession, onSuccess: invalidate });
  const exchange = useMutation({ mutationFn: securityFlow.sendEncryptedServiceRequest, onSuccess: invalidate });
  const closeSession = useMutation({ mutationFn: securityFlow.closeSession, onSuccess: invalidate });
  const reset = useMutation({
    mutationFn: securityFlow.resetEnvironment,
    onSuccess: async () => {
      forged.reset();
      await invalidate();
    },
  });

  const mutations = [register, authenticate, exchange, forged, closeSession, reset];
  const server = serverQuery.data;
  const identity = identityQuery.data;

  return {
    identity,
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
    registrationComplete: Boolean(identity?.userRegistered && server?.registered),
    sessionEstablished: Boolean(identity?.sessionId && server?.sessionEstablished),
    serviceExchanged: Boolean(server?.lastPlainResponse),
  };
}
