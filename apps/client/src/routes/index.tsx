import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  EyeIcon,
  FileTextIcon,
  FileUpIcon,
  ImageIcon,
  KeyRoundIcon,
  LockIcon,
  PlayIcon,
  RotateCcwIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  StopCircleIcon,
} from "lucide-react";
import { useState, type ChangeEvent, type ReactNode } from "react";

import { Evidence } from "#/components/evidence";
import { StepCard, type StepCardProps } from "#/components/step-card";
import { Alert, AlertDescription } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#/components/ui/card";
import type {
  DemoFileCurrentResponse,
  DemoFileServiceResponse,
  DemoFileTransferInput,
} from "#/lib/security-flow";
import { useSecurityFlow } from "#/lib/useSecurityFlow";

type FileServiceId = "upload" | "view";

export const Route = createFileRoute("/")({
  ssr: false,
  component: SecurityFlowPage,
});

function SecurityFlowPage() {
  const flow = useSecurityFlow();
  const { clientStatus, server, forged, busy, error } = flow;
  const [activeService, setActiveService] = useState<FileServiceId>("upload");
  const [selectedFile, setSelectedFile] = useState<DemoFileTransferInput>();
  const [currentFile, setCurrentFile] = useState<DemoFileCurrentResponse>();
  const [serviceMessage, setServiceMessage] = useState("Choose a service after authentication.");

  const steps: StepCardProps[] = [
    {
      title: "1. Register",
      description: "User and Server register with the TTP and receive certificates.",
      complete: flow.registrationComplete,
      icon: <KeyRoundIcon />,
      button: {
        label: "Register",
        icon: <PlayIcon />,
        onClick: () => flow.register.mutate(),
        disabled: busy,
      },
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

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      setSelectedFile(undefined);
      return;
    }

    setSelectedFile({
      name: file.name,
      mimeType: file.type || inferMimeType(file.name),
      contentBase64: await readFileAsBase64(file),
    });
    setServiceMessage("Selected file is ready for the Upload service.");
  };

  const handleUpload = () => {
    if (!selectedFile) return;
    flow.uploadFile.mutate(selectedFile, {
      onSuccess: (response) => showFileServiceResponse(response, "uploaded"),
    });
  };

  const handleView = () => {
    flow.viewFile.mutate(undefined, {
      onSuccess: (response) => showFileServiceResponse(response, "loaded from server"),
    });
  };

  const showFileServiceResponse = (response: DemoFileServiceResponse, action: string) => {
    if (response.kind === "file.current") {
      setCurrentFile(response);
      setServiceMessage(`${response.name} ${action}.`);
      return;
    }

    setCurrentFile(undefined);
    setServiceMessage("No uploaded file is currently stored on the server.");
  };

  const resetEnvironment = () => {
    setSelectedFile(undefined);
    setCurrentFile(undefined);
    setServiceMessage("Choose a service after authentication.");
    flow.reset.mutate();
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-6">
      <section className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">BSK / SCS project</p>
        <h1 className="text-3xl font-semibold tracking-normal text-foreground">
          Trusted Third Party flow
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Register, authenticate, transfer an AES-256 encrypted demo file, and verify forged
          certificate rejection.
        </p>
      </section>

      {error && (
        <Alert variant="destructive">
          <AlertTriangleIcon />
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        {steps.slice(0, 2).map((step) => (
          <StepCard key={step.title} {...step} />
        ))}

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span
                className={flow.serviceExchanged ? "text-emerald-300" : "text-muted-foreground"}
              >
                {flow.serviceExchanged ? <CheckCircle2Icon /> : <FileUpIcon />}
              </span>
              3. Use service
            </CardTitle>
            <CardDescription>Select one encrypted service for the current session.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <ServiceChoiceButton
                active={activeService === "upload"}
                icon={<FileUpIcon />}
                label="Upload file"
                onClick={() => setActiveService("upload")}
              />
              <ServiceChoiceButton
                active={activeService === "view"}
                icon={<EyeIcon />}
                label="View file"
                onClick={() => setActiveService("view")}
              />
            </div>

            {activeService === "upload" && (
              <div className="grid gap-3">
                <input
                  type="file"
                  accept="image/*,text/*,.txt,.md,.csv,.json"
                  onChange={handleFileSelected}
                  disabled={busy || !flow.sessionEstablished}
                  className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground disabled:opacity-50"
                />
                <Button
                  onClick={handleUpload}
                  disabled={busy || !flow.sessionEstablished || !selectedFile}
                >
                  <FileUpIcon />
                  Upload selected file
                </Button>
              </div>
            )}

            {activeService === "view" && (
              <Button
                variant="secondary"
                onClick={handleView}
                disabled={busy || !flow.sessionEstablished}
              >
                <EyeIcon />
                View current uploaded file
              </Button>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <Evidence
                label="Selected file"
                value={
                  selectedFile
                    ? `${selectedFile.name} (${base64ByteLength(selectedFile.contentBase64)} bytes)`
                    : flow.sessionEstablished
                      ? "choose a file"
                      : "start a session first"
                }
              />
              <Evidence
                label="Current server file"
                value={
                  currentFile ? `${currentFile.name} (${currentFile.size} bytes)` : serviceMessage
                }
              />
            </div>
            {currentFile && <TransferredFilePreview file={currentFile} />}
          </CardContent>
        </Card>

        {steps.slice(2).map((step) => (
          <StepCard key={step.title} {...step} />
        ))}
      </section>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="text-base">Current State</CardTitle>
          <CardDescription>Only the evidence needed for the presentation flow.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <Evidence
            label="User"
            value={clientStatus?.userRegistered ? "registered" : "not registered"}
          />
          <Evidence label="Server" value={server?.registered ? "registered" : "not registered"} />
          <Evidence
            label="Session"
            value={flow.sessionEstablished ? clientStatus?.sessionId : "not established"}
          />
          <Evidence
            label="Service"
            value={
              server?.latestDemoFile
                ? `${server.latestDemoFile.name} stored, ${server.latestDemoFile.size} bytes`
                : flow.serviceExchanged
                  ? "no file stored"
                  : "not used"
            }
          />
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
            <Button variant="ghost" onClick={resetEnvironment} disabled={busy}>
              <RotateCcwIcon />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function ServiceChoiceButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      onClick={onClick}
      className="justify-start"
    >
      {icon}
      {label}
    </Button>
  );
}

function TransferredFilePreview({ file }: { file: DemoFileCurrentResponse }) {
  if (file.mimeType.startsWith("image/")) {
    return (
      <div className="grid gap-2 rounded-md border p-3">
        <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
          <ImageIcon className="size-4" />
          Plain image preview
        </span>
        <img
          src={`data:${file.mimeType};base64,${file.contentBase64}`}
          alt={file.name}
          className="max-h-80 w-full rounded-md border object-contain"
        />
        <EncryptedPayloadView file={file} />
      </div>
    );
  }

  if (isTextFile(file)) {
    return (
      <div className="grid gap-2 rounded-md border p-3">
        <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
          <FileTextIcon className="size-4" />
          Plain text preview
        </span>
        <pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">
          {base64ToText(file.contentBase64)}
        </pre>
        <EncryptedPayloadView file={file} />
      </div>
    );
  }

  return (
    <div className="grid gap-2 rounded-md border p-3 text-sm text-muted-foreground">
      <span>The server returned this file, but only text and image previews are shown.</span>
      <EncryptedPayloadView file={file} />
    </div>
  );
}

function EncryptedPayloadView({ file }: { file: DemoFileCurrentResponse }) {
  return (
    <div className="grid gap-2 border-t pt-3">
      <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
        <LockIcon className="size-4" />
        Encrypted AES-GCM payload
      </span>
      <pre className="max-h-52 overflow-auto rounded-md bg-muted p-3 font-mono text-xs break-all whitespace-pre-wrap">
        {JSON.stringify(file.encryptedPayload, null, 2)}
      </pre>
    </div>
  );
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(",") + 1));
    });
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function inferMimeType(name: string) {
  if (/\.(txt|md|csv|json)$/i.test(name)) return "text/plain";
  return "application/octet-stream";
}

function isTextFile(file: DemoFileCurrentResponse) {
  return file.mimeType.startsWith("text/") || /\.(txt|md|csv|json)$/i.test(file.name);
}

function base64ByteLength(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0)).byteLength;
}

function base64ToText(value: string) {
  const bytes = Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
