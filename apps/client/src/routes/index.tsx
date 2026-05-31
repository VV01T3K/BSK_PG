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
import { useSecurityDemo } from "#/lib/useSecurityDemo";

export const Route = createFileRoute("/")({
  component: SecurityDemoDashboard,
});

function SecurityDemoDashboard() {
  const demo = useSecurityDemo();
  const { identity, server, forged, busy, error } = demo;

  const steps: StepCardProps[] = [
    {
      title: "1. Register",
      description: "User and Server register with the TTP and receive certificates.",
      complete: demo.registrationComplete,
      icon: <KeyRoundIcon />,
      button: { label: "Register", icon: <PlayIcon />, onClick: () => demo.register.mutate(), disabled: busy },
    },
    {
      title: "2. Authenticate",
      description: "The TTP validates certificates and issues a shared session key.",
      complete: demo.sessionEstablished,
      icon: <ShieldCheckIcon />,
      button: {
        label: "Start session",
        icon: <LockIcon />,
        onClick: () => demo.authenticate.mutate(),
        disabled: busy || !demo.serverRegistered,
      },
    },
    {
      title: "3. Use service",
      description: "The User sends one encrypted request to the protected Server.",
      complete: demo.serviceExchanged,
      icon: <TerminalIcon />,
      button: {
        label: "Exchange data",
        icon: <PlayIcon />,
        onClick: () => demo.exchange.mutate(),
        disabled: busy || !demo.sessionEstablished,
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
        disabled: busy || !demo.serverRegistered,
      },
    },
  ];

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
          <Evidence label="User" value={identity?.userRegistered ? "registered" : "not registered"} />
          <Evidence label="Server" value={server?.registered ? "registered" : "not registered"} />
          <Evidence label="Session" value={demo.sessionEstablished ? identity?.sessionId : "not established"} />
          <Evidence label="Service" value={demo.serviceExchanged ? "encrypted exchange complete" : "not used"} />
          <Evidence label="Forged certificate" value={forged.data?.message ?? "not tested"} />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => demo.closeSession.mutate()}
              disabled={busy || !demo.sessionEstablished}
            >
              <StopCircleIcon />
              Close session
            </Button>
            <Button variant="ghost" onClick={() => demo.reset.mutate()} disabled={busy}>
              <RotateCcwIcon />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
