import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { serviceQuery } from "#/api";
import { securityDemoFlow } from "./security-demo-flow";
import { clientIdentity } from "./state";

const CLIENT_IDENTITY_KEY = ["client-identity"] as const;

/** React adapter for the demo page: queries current state and exposes protocol steps as mutations. */
export function useSecurityDemo() {
  const queryClient = useQueryClient();
  const serverQuery = useQuery(serviceQuery.state.queryOptions());
  const identityQuery = useQuery({ queryKey: CLIENT_IDENTITY_KEY, queryFn: clientIdentity });

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: serviceQuery.state.key() }),
      queryClient.invalidateQueries({ queryKey: CLIENT_IDENTITY_KEY }),
    ]);

  const forged = useMutation({ mutationFn: securityDemoFlow.verifyForgedCertificateIsRejected });
  const register = useMutation({ mutationFn: securityDemoFlow.registerPrincipals, onSuccess: invalidate });
  const authenticate = useMutation({ mutationFn: securityDemoFlow.authenticateSession, onSuccess: invalidate });
  const exchange = useMutation({ mutationFn: securityDemoFlow.sendEncryptedServiceRequest, onSuccess: invalidate });
  const closeSession = useMutation({ mutationFn: securityDemoFlow.closeSession, onSuccess: invalidate });
  const reset = useMutation({
    mutationFn: securityDemoFlow.resetEnvironment,
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
