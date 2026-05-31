import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { serviceQuery } from "#/api";
import {
  authenticateSecurityDemoSession,
  closeSecurityDemoSession,
  exchangeEncryptedServiceMessage,
  registerSecurityDemoRoles,
  resetSecurityDemo,
  runForgedCertificateAttack,
} from "./actions";
import { clientIdentity } from "./state";

const CLIENT_IDENTITY_KEY = ["client-identity"] as const;

export function useSecurityDemo() {
  const queryClient = useQueryClient();
  const serverQuery = useQuery(serviceQuery.state.queryOptions());
  const identityQuery = useQuery({ queryKey: CLIENT_IDENTITY_KEY, queryFn: clientIdentity });

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: serviceQuery.state.key() }),
      queryClient.invalidateQueries({ queryKey: CLIENT_IDENTITY_KEY }),
    ]);

  const forged = useMutation({ mutationFn: runForgedCertificateAttack });
  const register = useMutation({ mutationFn: registerSecurityDemoRoles, onSuccess: invalidate });
  const authenticate = useMutation({ mutationFn: authenticateSecurityDemoSession, onSuccess: invalidate });
  const exchange = useMutation({ mutationFn: exchangeEncryptedServiceMessage, onSuccess: invalidate });
  const closeSession = useMutation({ mutationFn: closeSecurityDemoSession, onSuccess: invalidate });
  const reset = useMutation({
    mutationFn: resetSecurityDemo,
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
