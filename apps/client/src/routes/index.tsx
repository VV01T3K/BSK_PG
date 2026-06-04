import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangleIcon,
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
import { useState, type ChangeEvent } from "react";

import { Evidence } from "#/components/evidence";
import { Alert, AlertDescription } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Select } from "#/components/ui/select";
import type {
  DemoFileCurrentResponse,
  DemoFileServiceResponse,
  DemoFileTransferInput,
} from "#/lib/security-flow";
import { useSecurityFlow } from "#/lib/useSecurityFlow";

type FileServiceId = "upload" | "view";

export const Route = createFileRoute("/")({
  component: SecurityFlowPage,
});

function SecurityFlowPage() {
  const flow = useSecurityFlow();
  const { clientStatus, server, forged, busy, error } = flow;
  const [activeService, setActiveService] = useState<FileServiceId>("upload");
  const [selectedFile, setSelectedFile] = useState<DemoFileTransferInput>();
  const [currentFile, setCurrentFile] = useState<DemoFileCurrentResponse>();
  const [serviceMessage, setServiceMessage] = useState("Choose a service after authentication.");

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
    const uploadedName = selectedFile.name;
    flow.uploadFile.mutate(selectedFile, {
      onSuccess: () => {
        setCurrentFile(undefined);
        setServiceMessage(`${uploadedName} uploaded. Switch to View to fetch it from the server.`);
      },
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
    <main
      className={`mx-auto flex w-full max-w-5xl flex-col gap-5 p-6 ${busy ? "cursor-wait" : ""}`}
    >
      {error && (
        <Alert variant="destructive">
          <AlertTriangleIcon />
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span
                className={flow.registrationComplete ? "text-emerald-300" : "text-muted-foreground"}
              >
                <KeyRoundIcon />
              </span>
              1. Register
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => flow.register.mutate()} disabled={busy}>
              <PlayIcon />
              Register
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span
                className={flow.sessionEstablished ? "text-emerald-300" : "text-muted-foreground"}
              >
                <ShieldCheckIcon />
              </span>
              2. Authenticate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => flow.authenticate.mutate()}
              disabled={busy || !flow.serverRegistered}
            >
              <LockIcon />
              Start session
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span
                className={flow.serviceExchanged ? "text-emerald-300" : "text-muted-foreground"}
              >
                <FileUpIcon />
              </span>
              3. Use service
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase">Service</span>
            <Select<FileServiceId>
              value={activeService}
              onValueChange={setActiveService}
              disabled={busy || !flow.sessionEstablished}
              placeholder="Select a service"
              options={[
                { value: "upload", label: "Upload file service", icon: <FileUpIcon /> },
                { value: "view", label: "View file service", icon: <EyeIcon /> },
              ]}
            />
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span
                className={
                  forged.data?.rejected === true ? "text-emerald-300" : "text-muted-foreground"
                }
              >
                <ShieldAlertIcon />
              </span>
              4. Forged certificate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="secondary"
              onClick={() => forged.mutate()}
              disabled={busy || !flow.serverRegistered}
            >
              Run test
            </Button>
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {activeService === "upload" ? <FileUpIcon /> : <EyeIcon />}
            {activeService === "upload" ? "Upload service" : "View service"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
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
              Fetch file from server
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

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="text-base">Current State</CardTitle>
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
        Encrypted payload
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
