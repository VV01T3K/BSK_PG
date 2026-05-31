import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  KeyRoundIcon,
  LockIcon,
  PlayIcon,
  RotateCcwIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  StopCircleIcon,
  TerminalIcon,
} from "lucide-react";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#/components/ui/card";
import {
  authenticateSecurityDemoSession,
  closeSecurityDemoSession,
  exchangeEncryptedServiceMessage,
  registerSecurityDemoRoles,
  resetSecurityDemo,
  runForgedCertificateAttack,
} from "#/demo/actions";
import { clientIdentity } from "#/demo/state";
import { serviceQuery } from "#/api";

const CLIENT_IDENTITY_KEY = ["client-identity"] as const;

export const Route = createFileRoute("/")({
  component: SecurityDemoDashboard,
});

function SecurityDemoDashboard() {
  const queryClient = useQueryClient();
  const serverQuery = useQuery(serviceQuery.state.queryOptions());
  const identityQuery = useQuery({ queryKey: CLIENT_IDENTITY_KEY, queryFn: () => clientIdentity() });

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: serviceQuery.state.key() }),
      queryClient.invalidateQueries({ queryKey: CLIENT_IDENTITY_KEY }),
    ]);

  const forgedMutation = useMutation({ mutationFn: () => runForgedCertificateAttack() });
  const registerMutation = useMutation({ mutationFn: () => registerSecurityDemoRoles(), onSuccess: invalidate });
  const authMutation = useMutation({ mutationFn: () => authenticateSecurityDemoSession(), onSuccess: invalidate });
  const exchangeMutation = useMutation({ mutationFn: () => exchangeEncryptedServiceMessage(), onSuccess: invalidate });
  const closeMutation = useMutation({ mutationFn: () => closeSecurityDemoSession(), onSuccess: invalidate });
  const resetMutation = useMutation({
    mutationFn: () => resetSecurityDemo(),
    onSuccess: async () => {
      forgedMutation.reset();
      await invalidate();
    },
  });

  const server = serverQuery.data;
  const identity = identityQuery.data;
  const sessionEstablished = Boolean(identity?.sessionId && server?.sessionEstablished);
  const serviceExchanged = Boolean(server?.lastPlainResponse);
  const busy =
    registerMutation.isPending ||
    authMutation.isPending ||
    exchangeMutation.isPending ||
    forgedMutation.isPending ||
    closeMutation.isPending ||
    resetMutation.isPending;

  const error =
    registerMutation.error ||
    authMutation.error ||
    exchangeMutation.error ||
    forgedMutation.error ||
    closeMutation.error ||
    resetMutation.error;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-6">
      <section className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">BSK / SCS project</p>
        <h1 className="text-3xl font-semibold tracking-normal text-foreground">Trusted Third Party demo</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Minimal client view for registration, authentication, AES-256 service exchange, and forged certificate
          rejection.
        </p>
      </section>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          {(error as Error).message}
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <StepCard
          title="1. Register"
          description="User and Server register with the TTP and receive certificates."
          complete={Boolean(identity?.userRegistered && server?.registered)}
          icon={<KeyRoundIcon />}
        >
          <Button onClick={() => registerMutation.mutate()} disabled={busy}>
            <PlayIcon />
            Register
          </Button>
        </StepCard>

        <StepCard
          title="2. Authenticate"
          description="The TTP validates certificates and issues a shared session key."
          complete={sessionEstablished}
          icon={<ShieldCheckIcon />}
        >
          <Button onClick={() => authMutation.mutate()} disabled={busy || !server?.registered}>
            <LockIcon />
            Start session
          </Button>
        </StepCard>

        <StepCard
          title="3. Use service"
          description="The User sends one encrypted request to the protected Server."
          complete={serviceExchanged}
          icon={<TerminalIcon />}
        >
          <Button onClick={() => exchangeMutation.mutate()} disabled={busy || !sessionEstablished}>
            <PlayIcon />
            Exchange data
          </Button>
        </StepCard>

        <StepCard
          title="4. Forged certificate"
          description="The TTP rejects a User identity paired with the Server certificate."
          complete={forgedMutation.data?.rejected === true}
          icon={<ShieldAlertIcon />}
        >
          <Button variant="secondary" onClick={() => forgedMutation.mutate()} disabled={busy || !server?.registered}>
            Run test
          </Button>
        </StepCard>
      </section>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="text-base">Current State</CardTitle>
          <CardDescription>Only the evidence needed for the presentation flow.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <Evidence label="User" value={identity?.userRegistered ? "registered" : "not registered"} />
          <Evidence label="Server" value={server?.registered ? "registered" : "not registered"} />
          <Evidence label="Session" value={sessionEstablished ? identity?.sessionId : "not established"} />
          <Evidence label="Service" value={serviceExchanged ? "encrypted exchange complete" : "not used"} />
          <Evidence label="Forged certificate" value={forgedMutation.data?.message ?? "not tested"} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => closeMutation.mutate()} disabled={busy || !sessionEstablished}>
              <StopCircleIcon />
              Close session
            </Button>
            <Button variant="ghost" onClick={() => resetMutation.mutate()} disabled={busy}>
              <RotateCcwIcon />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function StepCard({
  title,
  description,
  complete,
  icon,
  children,
}: {
  title: string;
  description: string;
  complete: boolean;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className={complete ? "text-emerald-300" : "text-muted-foreground"}>
            {complete ? <CheckCircle2Icon /> : icon}
          </span>
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Evidence({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid gap-1 rounded-md border p-3">
      <span className="text-xs font-medium uppercase text-muted-foreground">{label}</span>
      <span className="break-all font-mono text-xs">{value ?? "not available"}</span>
    </div>
  );
}
