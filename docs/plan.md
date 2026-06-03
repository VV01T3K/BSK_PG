# Add a real "Secure File Transfer" service over the authenticated session

## Context

The BSK/SCS project requires a **Server that provides a service** (the task names "web
service, data transfer") and a client GUI that "allows **selection of a service** after
initial authentication." Today the whole security protocol is fully implemented
(RSA-4096, AES-256-GCM, X.509 certs, TTP session-key issuance, forged-cert/MITM test),
but the "service" is a placeholder echo:

- [apps/server/src/protocol.ts:111-123](apps/server/src/protocol.ts#L111-L123) — `exchangeProtectedServiceData` just returns `"Protected service accepted encrypted request: …"`.
- [apps/client/src/lib/security-flow.ts:52-61](apps/client/src/lib/security-flow.ts#L52-L61) — sends one hardcoded string referencing a "grade-summary service" that doesn't exist.
- The GUI is a fixed 4-step flow with a single "Exchange data" button — no real service, no selection.

**Goal:** replace the echo with a genuine application service — a **secure file vault**
(list / upload / download / delete) — reachable through a **service catalog** the client
selects from after authentication. Data is kept **in memory** on the server.

**Key design principle (low risk):** the service is a JSON layer _inside_ the existing
encrypted session channel. The AES-256-GCM cipher, RPC transport, TTP auth, and certificate
logic are **untouched** — we only change what plaintext flows through the session and add a
dispatcher. The wire shape stays `{ payload: SessionEncryptedPayload } -> { payload: SessionEncryptedPayload }`.

## Design overview

After a session key is established, the client encrypts a JSON `ServiceRequest` with the
session cipher and the server decrypts, dispatches, and returns an encrypted `ServiceResponse`.
Services offered:

- `catalog` — server returns the list of available services (drives the GUI menu).
- `files` — `list` / `upload` / `download` / `delete` against an in-memory vault.
- `echo` — kept as a trivial second catalog entry (demonstrates "selection").

File bytes travel as base64 strings inside the JSON envelope, so the existing UTF-8-based
`aesGcm` helper ([packages/crypto/src/crypto.ts:98-150](packages/crypto/src/crypto.ts#L98-L150)) works unchanged.

## Files to change

### 1. Shared service contract (new) — single source of truth

- **New** [apps/server/src/service-contract.ts](apps/server/src/service-contract.ts): mirror the `ttp/contract` pattern. Export:
  - `ServiceId = "files" | "echo"`, `ServiceCatalogEntry { id, name, description }`
  - `VaultFileMeta { name, size, modified }`
  - Discriminated unions `ServiceRequest` (`{kind:"catalog"} | {kind:"files.list"} | {kind:"files.upload",name,contentBase64} | {kind:"files.download",name} | {kind:"files.delete",name} | {kind:"echo",message}`) and matching `ServiceResponse`.
  - `encode/decodeServiceRequest` and `encode/decodeServiceResponse` (`JSON.stringify`/`parse`).
- **Edit** [apps/server/package.json](apps/server/package.json): add `"./contract": "./src/service-contract.ts"` to `exports` (exactly like [apps/ttp/package.json:4-7](apps/ttp/package.json#L4-L7)).

### 2. Server

- [apps/server/src/state.ts](apps/server/src/state.ts):
  - Add `vault: Map<string, VaultFile>` to `ServiceServerState` (init alongside `pendingRequests`); `VaultFile = VaultFileMeta & { contentBase64 }`.
  - Add `seedVault()` (e.g. `welcome.txt`, `grades.csv`) so list/download work before any upload; call it at module load and from `resetServiceServerState` (which must `vault.clear()` then reseed).
  - Extend `ServiceServerStatus`/`readServiceServerStatus` with `fileCount: number`; keep `serviceExchanged` (set true on the first successful invoke) so existing status wiring still works.
- [apps/server/src/protocol.ts](apps/server/src/protocol.ts): replace `exchangeProtectedServiceData` with `invokeProtectedService(payload)`:
  - Decrypt → `decodeServiceRequest` → `switch (req.kind)` dispatch to small pure handlers (`listFiles`, `uploadFile`, `downloadFile`, `deleteFile`, `serviceCatalog`, `echo`) → `encodeServiceResponse` → re-encrypt with the same session cipher.
  - Reuse `requireSessionKey()` and `aesGcm.withKey(...).forSession(...)` exactly as the echo does today.
- [apps/server/src/rpc.ts](apps/server/src/rpc.ts): rename `service.exchange` → `service.invoke` (same `{ payload }` in/out), call `invokeProtectedService`, and log the decoded op (e.g. `log("file uploaded", "report.pdf (12 KB)")`) so the Server log shows real, timestamped service activity.

### 3. Client

- [apps/client/src/api.ts](apps/client/src/api.ts): import `ServiceRequest`/`ServiceResponse`/`ServiceCatalogEntry`/`VaultFileMeta` from `server/contract`.
- [apps/client/src/lib/security-flow.ts](apps/client/src/lib/security-flow.ts): replace `sendEncryptedServiceRequest` with a generic `invokeService(req): Promise<ServiceResponse>` (encrypt envelope via the active session cipher, call `service.service.invoke`, decrypt+decode response). Add typed wrappers: `loadCatalog`, `listFiles`, `uploadFile`, `downloadFile`, `deleteFile`, `pingEcho`. Keep `activeSession()`/`registeredUser()` reuse.
- [apps/client/src/lib/useSecurityFlow.ts](apps/client/src/lib/useSecurityFlow.ts): add a `catalog` query (after session established) plus `upload`/`download`/`delete` mutations that invalidate a file-list query; surface `busy`/`error` the same way.
- **New** `apps/client/src/components/service-panel.tsx`: rendered below the security steps once `sessionEstablished`. Shows the catalog as a selector (file vault / echo), and for the vault a file table (name/size/modified with Download + Delete buttons) and an upload control (`<input type=file>` → base64 → `uploadFile`). Use lucide icons (`FolderIcon`, `UploadIcon`, `DownloadIcon`, `Trash2Icon`, `FileIcon`) per the spec's status-icon requirement. Browser file I/O via `FileReader`/`Blob` helpers.
- [apps/client/src/routes/index.tsx](apps/client/src/routes/index.tsx): repurpose step 3 to point at the services panel (e.g. "Open services") and render `<ServicePanel>` after the steps; update the "Service" evidence row to reflect real activity (e.g. `"<n> files in vault"`).

### 4. Tests & docs

- **New** `apps/server/tests/service.test.ts` (Bun): drive `invokeProtectedService` through a real session cipher — assert catalog lists both services, round-trip upload→list→download (bytes match), delete removes the entry, and a wrong/foreign session key fails to decrypt. Strengthens the report's "tests" section.
- Update [apps/client/tests/security-flow.e2e.ts](apps/client/tests/security-flow.e2e.ts): replace the "Exchange data"/"encrypted exchange complete" assertions with the new services panel — select the file vault, upload a file, assert it appears in the list and the "Service" row updates; fix the reset test's expected "Service" value.
- Quickly confirm [apps/client/tests/client-security-state.test.ts](apps/client/tests/client-security-state.test.ts) and the crypto/ttp tests stay green (they don't touch the service layer).
- Add a short "Services" note to [README.md](README.md). (Doxygen left untouched per prior decision.)

## Verification

1. `bun install` then `bun run dev`; open `http://localhost:3000`.
2. Click **Register** → **Start session** (auth/cert flow unchanged).
3. In the new **Services** panel: select **Secure file vault**, see seeded files, **upload** a local file, confirm it appears in the list, **download** it and verify contents match, **delete** it. Switch to **Echo** to confirm catalog selection.
4. Confirm `logs/server.log` shows timestamped entries per file op, and that an error alert never renders during the happy path.
5. `bun run test` (unit/Bun + Playwright e2e) and `bun run typecheck`/`bun run ready` all pass.
6. `docker compose -f docker/compose.yaml up --build` and repeat step 3 in the container ("VM") environment.
