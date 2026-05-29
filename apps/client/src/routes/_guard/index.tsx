import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type React from "react";
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
  getSecurityDemoState,
  registerSecurityDemoRoles,
  resetSecurityDemo,
  runForgedCertificateAttack,
  runMitmTamperAttack,
} from "#/demo/actions";
import type { SecurityDemoSnapshot } from "#/demo/types";
import { getTtpHealth } from "#/api/ttp-client";

export const Route = createFileRoute("/_guard/")({
  component: SecurityDemoDashboard,
});

function SecurityDemoDashboard() {
  const queryClient = useQueryClient();
  const stateQuery = useQuery({
    queryKey: ["security-demo-state"],
    queryFn: () => getSecurityDemoState(),
  });
  const healthQuery = useQuery({
    queryKey: ["ttp-health"],
    queryFn: getTtpHealth,
    refetchInterval: 5_000,
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["security-demo-state"] }),
      queryClient.invalidateQueries({ queryKey: ["ttp-health"] }),
    ]);
  };

  const registerMutation = useMutation({ mutationFn: () => registerSecurityDemoRoles(), onSuccess: invalidate });
  const authMutation = useMutation({ mutationFn: () => authenticateSecurityDemoSession(), onSuccess: invalidate });
  const exchangeMutation = useMutation({
    mutationFn: () => exchangeEncryptedServiceMessage(),
    onSuccess: invalidate,
  });
  const forgedMutation = useMutation({ mutationFn: () => runForgedCertificateAttack(), onSuccess: invalidate });
  const mitmMutation = useMutation({ mutationFn: () => runMitmTamperAttack(), onSuccess: invalidate });
  const closeMutation = useMutation({ mutationFn: () => closeSecurityDemoSession(), onSuccess: invalidate });
  const resetMutation = useMutation({ mutationFn: () => resetSecurityDemo(), onSuccess: invalidate });

  const state = stateQuery.data;
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
    stateQuery.error ||
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
          complete={Boolean(state?.userRegistered && state.serverRegistered)}
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
          complete={Boolean(state?.sessionEstablished)}
          icon={<ShieldCheckIcon />}
          action={
            <Button onClick={() => authMutation.mutate()} disabled={busy || !state?.serverRegistered}>
              <LockIcon />
              Start session
            </Button>
          }
        />
        <StatusCard
          title="3. Service"
          description="Client and protected Server exchange AES-256-GCM envelopes."
          complete={Boolean(state?.lastEncryptedResponse)}
          icon={<TerminalIcon />}
          action={
            <Button onClick={() => exchangeMutation.mutate()} disabled={busy || !state?.sessionEstablished}>
              <PlayIcon />
              Exchange data
            </Button>
          }
        />
        <StatusCard
          title="4. Attacks"
          description="Show forged certificate and MITM/tamper rejection."
          complete={Boolean(state?.forgedCertificateRejected && state.mitmRejected)}
          icon={<ShieldAlertIcon />}
          action={
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => forgedMutation.mutate()}
                disabled={busy || !state?.serverRegistered}
              >
                Forged cert
              </Button>
              <Button variant="secondary" onClick={() => mitmMutation.mutate()} disabled={busy || !state?.sessionEstablished}>
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
            <Evidence label="User ID" value={state?.userId} />
            <Evidence label="User certificate" value={state?.userCertificateFingerprint} />
            <Evidence label="Server ID" value={state?.serverId} />
            <Evidence label="Server certificate" value={state?.serverCertificateFingerprint} />
            <Evidence label="Session ID" value={state?.sessionId} />
            <Evidence label="Expires" value={state?.sessionExpiresAt} />
            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" onClick={() => closeMutation.mutate()} disabled={busy || !state?.sessionEstablished}>
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
            <PayloadBlock title="User plaintext request" value={state?.lastPlainRequest} />
            <PayloadBlock title="Encrypted request envelope" value={formatEnvelope(state?.lastEncryptedRequest)} />
            <PayloadBlock title="Server plaintext response" value={state?.lastPlainResponse} />
            <PayloadBlock title="Encrypted response envelope" value={formatEnvelope(state?.lastEncryptedResponse)} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="text-base">Attack Results</CardTitle>
            <CardDescription>Both failures are required demonstration evidence.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <AttackResult label="Forged certificate" ok={state?.forgedCertificateRejected} message={state?.forgedCertificateMessage} />
            <AttackResult label="MITM tamper" ok={state?.mitmRejected} message={state?.mitmMessage} />
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="text-base">Timestamped Event Log</CardTitle>
            <CardDescription>Client, protected Server, and TTP outcomes returned to the UI.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-80 space-y-2 overflow-auto pr-1 text-sm">
              {(state?.logs ?? []).map((entry) => (
                <div key={`${entry.timestamp}-${entry.event}`} className="grid gap-1 rounded-md border p-3 md:grid-cols-[10rem_5rem_1fr]">
                  <span className="font-mono text-xs text-muted-foreground">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                  <span className="text-xs font-medium uppercase text-muted-foreground">{entry.actor}</span>
                  <span>
                    <span className={entry.level === "warn" ? "text-yellow-300" : "text-foreground"}>{entry.event}</span>
                    <span className="text-muted-foreground"> - {entry.details}</span>
                  </span>
                </div>
              ))}
              {!state?.logs?.length && <p className="text-muted-foreground">No events yet.</p>}
            </div>
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
  icon: React.ReactNode;
  action: React.ReactNode;
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

function formatEnvelope(envelope?: SecurityDemoSnapshot["lastEncryptedRequest"]): string | undefined {
  if (!envelope) {
    return undefined;
  }

  return JSON.stringify(envelope, null, 2);
}
