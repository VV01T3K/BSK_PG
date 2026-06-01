# SCS project — TODO handoff (for another model/agent)

> Standalone, ordered task list. Each item is self-contained: what to do, where, how to verify.
> Read these three docs first for context: `docs/SCS_2026_project_task.md` (the graded spec),
> `docs/deviations.md` (conformance status), `docs/fig2-conformance-plan.md` (the flow-refactor spec).

## Ground rules (read before touching anything)

- **Stack:** Bun + TypeScript monorepo. Apps: `apps/client` (React/Vite, port via Vite),
  `apps/server` (:3002), `apps/ttp` (:3001). Shared: `packages/crypto`, `packages/rpc` (oRPC).
- **Do NOT change `packages/crypto`.** RSA-4096, AES-256-GCM, SHA-256, hybrid envelope, PRNG
  session key are all correct and in spec.
- **Do NOT add CA-signature certificate verification.** Cert validation is a stored-PEM lookup by
  design and is in spec for Task 4 (see `deviations.md` §B1). Leave it.
- **Docker = VMs.** `docker/compose.yaml` is the confirmed-accepted VM environment (Task 2 done).
  Do not migrate to real VMs.
- Run `bun test` and `bun run typecheck` after code changes; keep them green.
- Work on a branch, not `main`. Commit step-by-step.

> **Out of scope for this list:** Doxygen documentation and GitLab repository logistics are
> handled separately and are **not** part of these tasks. Do not work on them here.

---

## Phase 1 — Flow refactor: match the PDF (Fig. 2 + §2 prose)

Full spec with endpoint signatures, state maps, and a target sequence diagram is in
`docs/fig2-conformance-plan.md`. Implement G1→G4 **in order**; keep tests green between steps.

- [ ] **T1 (G1) — Add `Service request` (User → Server).**
  New Server endpoint `service.requestService({ userId })`. Generate `requestId`, store a pending
  record in server state, then perform T2/T3 and return the redirect payload.
  Files: `apps/server/src/{rpc,protocol,state}.ts`. Client (`apps/client/src/lib/security-flow.ts`)
  calls this first in `authenticateSession()`.

- [ ] **T2 (G2) — Server forwards to TTP (`User, Server auth.`).**
  Extend `ttp.auth.server` input with `userId`; record a `pendingAuths` entry keyed by `requestId`
  (`apps/ttp/src/state.ts`). Add `userId` to the signed `serverAuthenticationPayload` in **both**
  `apps/server/src/protocol.ts` and `apps/ttp/src/protocol.ts` (must stay byte-identical).
  Server's `requestService` calls `ttp.auth.server({ serverId, certificatePem, requestId, userId,
  signature })`.

- [ ] **T3 (G3) — Relay `Server auth. OK` + `User Auth. redirect`.**
  `requestService` returns `{ serverAuthenticated: true, requestId, ttpBaseUrl }`. Client then
  calls `ttp.auth.user` directly (already correct) but includes `requestId` in the signed
  `UserAuthenticationRequest`. In `ttp.auth.user`: look up `pendingAuths.get(requestId)`, require
  `expectedUserId === request.userId` and matching `serverId`, else reject `UNAUTHORIZED`. Then
  validate certs+signature as today, create the session, store `encryptedSessionKeyForServer` in
  the session record keyed by `requestId`. Response to User: `{ sessionId,
  encryptedSessionKeyForUser }` only.

- [ ] **T4 (G4) — Server pulls its session key from the TTP.**
  New TTP endpoint `session.serverKey({ requestId })` → `{ sessionId,
  encryptedSessionKeyForServer }`. Add a thin `service.server.fetchKey({ requestId })` on the
  Server that calls it, decrypts with the server `exchangeKeyPair` (reuse `decryptSessionTicket`),
  and stores `sessionId`+`sessionKey` locally. Client calls `fetchKey` after its own auth
  succeeds. **Remove** `server.authenticate` (folded into `requestService`) and
  `server.acceptSession` (no more User→Server key relay).

- [ ] **T5 — Update tests.**
  `apps/ttp/src/index.test.ts`: `auth.server` fixtures pass `userId` (signature covers it); add a
  test that `auth.user` rejects an unknown/mismatched `requestId`; add a `session.serverKey` test
  that the returned key decrypts to the same `sessionKey` the User holds. Keep the existing
  forged-cert / invalid-signature negative tests unchanged (Task 4).

- [ ] **T6 — Manual verification.**
  Run the stack (`docker/compose.yaml` or local `bun`). Walk the GUI: register → service request →
  server auth OK → user auth → encrypted exchange → close. Confirm the Server's key comes from the
  TTP (check `logs/ttp.log`). Confirm the forged-cert step is still rejected.

**Phase 1 acceptance:** `bun test` + `bun run typecheck` green; GUI flow matches Fig. 2 order;
forged-cert still rejected; `logs/ttp.log` and `logs/server.log` show the new messages.

---

## Phase 2 — Report (Tab. 1 item 7, 15 pts) — does NOT require code changes

Write the technical report (separate document; ask the user for the target format/location).

- [ ] **T7 — Description of the realised task** (4 pts). Use `docs/actual-protocol.md` as source.
- [ ] **T8 — Key functionality with code listings** (3 pts). Pull listings from `packages/crypto/src/crypto.ts`
  (hybrid encrypt, AES-GCM, sign/verify), `apps/ttp/src/protocol.ts` (auth + session issue),
  `apps/ttp/src/certificates.ts` (validation). Short, substantive descriptions.
- [ ] **T9 — Tests section** (part of the report). Summarize `packages/crypto/tests/*` and
  `apps/ttp/src/index.test.ts`: auth validation, forged-cert/MITM, encryption/decryption,
  network/RPC. Describe the forged-cert mechanism **accurately**: "the TTP rejects any certificate
  that does not match the one it issued during registration" — NOT CA-signature re-verification.
- [ ] **T10 — Bibliography** (2 pts). Cite RSA/OAEP, AES-GCM, SHA-256, X.509, node-forge, oRPC.

---

## Status reference (already done — do not redo)

✅ Three apps, enrollment, two RSA key pairs, hashed+encrypted IDs, X.509 certs, RSA-4096,
PRNG session key, AES-256-GCM, status icons, timestamped Server/TTP logs, single user, forged-cert
rejection (Task 4), encrypted data exchange, session close. Docker-as-VM accepted (Task 2).
