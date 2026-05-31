import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  ActivityIcon,
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
  runMitmTamperAttack,
} from "#/demo/actions";
import { clientIdentity } from "#/demo/state";
import type { SessionEncryptedPayload } from "#/demo/types";
import { serviceQuery, ttpQuery } from "#/api";

const CLIENT_IDENTITY_KEY = ["client-identity"] as const;

export const Route = createFileRoute("/")({
  component: SecurityDemoDashboard,
});

function SecurityDemoDashboard() {
  const queryClient = useQueryClient();
  const serverQuery = useQuery(serviceQuery.state.queryOptions());
  const identityQuery = useQuery({ queryKey: CLIENT_IDENTITY_KEY, queryFn: () => clientIdentity() });
  const healthQuery = useQuery({
    ...ttpQuery.health.queryOptions(),
    refetchInterval: 5_000,
  });

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: serviceQuery.state.key() }),
      queryClient.invalidateQueries({ queryKey: CLIENT_IDENTITY_KEY }),
    ]);

  const forgedMutation = useMutation({ mutationFn: () => runForgedCertificateAttack() });
  const mitmMutation = useMutation({ mutationFn: () => runMitmTamperAttack() });
  const registerMutation = useMutation({ mutationFn: () => registerSecurityDemoRoles(), onSuccess: invalidate });
  const authMutation = useMutation({ mutationFn: () => authenticateSecurityDemoSession(), onSuccess: invalidate });
  const exchangeMutation = useMutation({ mutationFn: () => exchangeEncryptedServiceMessage(), onSuccess: invalidate });
  const closeMutation = useMutation({ mutationFn: () => closeSecurityDemoSession(), onSuccess: invalidate });
  const resetMutation = useMutation({
    mutationFn: () => resetSecurityDemo(),
    onSuccess: async () => {
      forgedMutation.reset();
      mitmMutation.reset();
      await invalidate();
    },
  });

  const server = serverQuery.data;
  const identity = identityQuery.data;
  const sessionEstablished = Boolean(identity?.sessionId && server?.sessionEstablished);
  const busy =
    registerMutation.isPending ||
    authMutation.isPending ||
    exchangeMutation.isPending ||
    forgedMutation.isPending ||
    mitmMutation.isPending ||
    closeMutation.isPending ||
    resetMutation.isPending;

  const error =
    registerMutation.error ||
    authMutation.error ||
    exchangeMutation.error ||
    forgedMutation.error ||
    mitmMutation.error ||
    closeMutation.error ||
    resetMutation.error ||
    healthQuery.error;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="flex min-w-0 flex-col gap-3">
          <p className="text-sm font-medium text-muted-foreground">BSK / SCS trusted-third-party scenario</p>
          <h1 className="text-3xl font-semibold tracking-normal text-foreground">
            Three-application security demo
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Register the Client and protected Server with the TTP, authenticate them, exchange AES-256 encrypted
            service data, then demonstrate forged certificate and tamper rejection.
          </p>
        </div>
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ActivityIcon />
              TTP status
            </CardTitle>
            <CardDescription>{healthQuery.data?.service ?? "health check"}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3 text-sm">
            <Metric label="Health" value={healthQuery.data?.ok ? "OK" : "Waiting"} good={healthQuery.data?.ok} />
            <Metric label="Principals" value={String(healthQuery.data?.registeredPrincipals ?? 0)} />
            <Metric label="Sessions" value={String(healthQuery.data?.activeSessions ?? 0)} />
          </CardContent>
        </Card>
      </section>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          {(error as Error).message}
        </div>
      )}

      <section className="grid gap-4 xl:grid-cols-4">
        <StatusCard
          title="1. Registration"
          description="Client and Server each generate IDs and two RSA-4096 key pairs."
          complete={Boolean(identity?.userRegistered && server?.registered)}
          icon={<KeyRoundIcon />}
          action={
            <Button onClick={() => registerMutation.mutate()} disabled={busy}>
              <PlayIcon />
              Register roles
            </Button>
          }
        />
        <StatusCard
          title="2. Authentication"
          description="Server and User certificates are validated by the TTP."
          complete={sessionEstablished}
          icon={<ShieldCheckIcon />}
          action={
            <Button onClick={() => authMutation.mutate()} disabled={busy || !server?.registered}>
              <LockIcon />
              Start session
            </Button>
          }
        />
        <StatusCard
          title="3. Service"
          description="Client and protected Server exchange AES-256-GCM payloads."
          complete={Boolean(server?.lastEncryptedResponse)}
          icon={<TerminalIcon />}
          action={
            <Button onClick={() => exchangeMutation.mutate()} disabled={busy || !sessionEstablished}>
              <PlayIcon />
              Exchange data
            </Button>
          }
        />
        <StatusCard
          title="4. Attacks"
          description="Show forged certificate and MITM/tamper rejection."
          complete={forgedMutation.data?.rejected === true && mitmMutation.data?.rejected === true}
          icon={<ShieldAlertIcon />}
          action={
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => forgedMutation.mutate()}
                disabled={busy || !server?.registered}
              >
                Forged cert
              </Button>
              <Button variant="secondary" onClick={() => mitmMutation.mutate()} disabled={busy || !sessionEstablished}>
                Tamper
              </Button>
            </div>
          }
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="text-base">Identity and Session Evidence</CardTitle>
            <CardDescription>Short fingerprints keep the presentation readable.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Evidence label="User ID" value={identity?.userId} />
            <Evidence label="User certificate" value={identity?.userCertificateFingerprint} />
            <Evidence label="Server ID" value={server?.serverId} />
            <Evidence label="Server certificate" value={server?.certificateFingerprint} />
            <Evidence label="Session ID" value={identity?.sessionId} />
            <Evidence label="Expires" value={identity?.sessionExpiresAt ?? server?.sessionExpiresAt} />
            <div className="flex flex-wrap gap-2 pt-2">
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

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="text-base">Encrypted Service Exchange</CardTitle>
            <CardDescription>Plaintext is shown only as demo evidence; transfer payloads are encrypted.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm lg:grid-cols-2">
            <PayloadBlock title="User plaintext request" value={server?.lastPlainRequest} />
            <PayloadBlock title="Encrypted request payload" value={formatPayload(server?.lastEncryptedRequest)} />
            <PayloadBlock title="Server plaintext response" value={server?.lastPlainResponse} />
            <PayloadBlock title="Encrypted response payload" value={formatPayload(server?.lastEncryptedResponse)} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="text-base">Attack Results</CardTitle>
            <CardDescription>Both failures are required demonstration evidence.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <AttackResult label="Forged certificate" ok={forgedMutation.data?.rejected} message={forgedMutation.data?.message} />
            <AttackResult label="MITM tamper" ok={mitmMutation.data?.rejected} message={mitmMutation.data?.message} />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function Metric({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={good ? "font-semibold text-emerald-300" : "font-semibold"}>{value}</div>
    </div>
  );
}

function StatusCard({
  title,
  description,
  complete,
  icon,
  action,
}: {
  title: string;
  description: string;
  complete: boolean;
  icon: ReactNode;
  action: ReactNode;
}) {
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className={complete ? "text-emerald-300" : "text-muted-foreground"}>{complete ? <CheckCircle2Icon /> : icon}</span>
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{action}</CardContent>
    </Card>
  );
}

function Evidence({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid gap-1 rounded-md border p-3 md:grid-cols-[10rem_1fr]">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-all font-mono text-xs">{value ?? "not available"}</span>
    </div>
  );
}

function PayloadBlock({ title, value }: { title: string; value?: string }) {
  return (
    <div className="min-h-32 rounded-md border p-3">
      <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">{title}</div>
      <pre className="whitespace-pre-wrap break-all font-mono text-xs leading-5 text-foreground">{value ?? "not exchanged yet"}</pre>
    </div>
  );
}

function AttackResult({ label, ok, message }: { label: string; ok?: boolean; message?: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center gap-2 font-medium">
        {ok ? <CheckCircle2Icon className="size-4 text-emerald-300" /> : <AlertTriangleIcon className="size-4 text-muted-foreground" />}
        {label}
      </div>
      <p className="mt-1 text-muted-foreground">{message ?? "not tested yet"}</p>
    </div>
  );
}

function formatPayload(payload?: SessionEncryptedPayload): string | undefined {
  if (!payload) {
    return undefined;
  }

  return JSON.stringify(payload, null, 2);
}
