import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangleIcon,
  KeyRoundIcon,
  LockIcon,
  PlayIcon,
  RotateCcwIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  StopCircleIcon,
  TerminalIcon,
} from "lucide-react";
import { Evidence } from "#/components/evidence";
import { StepCard, type StepCardProps } from "#/components/step-card";
import { Alert, AlertDescription } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#/components/ui/card";
import { useSecurityFlow } from "#/lib/useSecurityFlow";

export const Route = createFileRoute("/")({
  component: SecurityFlowPage,
});

function SecurityFlowPage() {
  const flow = useSecurityFlow();
  const { clientStatus, server, forged, busy, error } = flow;

  const steps: StepCardProps[] = [
    {
      title: "1. Register",
      description: "User and Server register with the TTP and receive certificates.",
      complete: flow.registrationComplete,
      icon: <KeyRoundIcon />,
      button: { label: "Register", icon: <PlayIcon />, onClick: () => flow.register.mutate(), disabled: busy },
    },
    {
      title: "2. Authenticate",
      description: "The TTP validates certificates and issues a shared session key.",
      complete: flow.sessionEstablished,
      icon: <ShieldCheckIcon />,
      button: {
        label: "Start session",
        icon: <LockIcon />,
        onClick: () => flow.authenticate.mutate(),
        disabled: busy || !flow.serverRegistered,
      },
    },
    {
      title: "3. Use service",
      description: "The User sends one encrypted request to the protected Server.",
      complete: flow.serviceExchanged,
      icon: <TerminalIcon />,
      button: {
        label: "Exchange data",
        icon: <PlayIcon />,
        onClick: () => flow.exchange.mutate(),
        disabled: busy || !flow.sessionEstablished,
      },
    },
    {
      title: "4. Forged certificate",
      description: "The TTP rejects a User identity paired with the Server certificate.",
      complete: forged.data?.rejected === true,
      icon: <ShieldAlertIcon />,
      button: {
        label: "Run test",
        variant: "secondary",
        onClick: () => forged.mutate(),
        disabled: busy || !flow.serverRegistered,
      },
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-6">
      <section className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">BSK / SCS project</p>
        <h1 className="text-3xl font-semibold tracking-normal text-foreground">Trusted Third Party flow</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Register, authenticate, exchange AES-256 encrypted service data, and verify forged certificate rejection.
        </p>
      </section>

      {error && (
        <Alert variant="destructive">
          <AlertTriangleIcon />
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        {steps.map((step) => (
          <StepCard key={step.title} {...step} />
        ))}
      </section>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="text-base">Current State</CardTitle>
          <CardDescription>Only the evidence needed for the presentation flow.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <Evidence label="User" value={clientStatus?.userRegistered ? "registered" : "not registered"} />
          <Evidence label="Server" value={server?.registered ? "registered" : "not registered"} />
          <Evidence label="Session" value={flow.sessionEstablished ? clientStatus?.sessionId : "not established"} />
          <Evidence label="Service" value={flow.serviceExchanged ? "encrypted exchange complete" : "not used"} />
          <Evidence label="Forged certificate" value={forged.data?.message ?? "not tested"} />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => flow.closeSession.mutate()}
              disabled={busy || !flow.sessionEstablished}
            >
              <StopCircleIcon />
              Close session
            </Button>
            <Button variant="ghost" onClick={() => flow.reset.mutate()} disabled={busy}>
              <RotateCcwIcon />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
