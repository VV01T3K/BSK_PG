# Plan — make the auth flow a perfect match of the PDF (Fig. 2 + §2 prose)

> **Status: planned, not implemented.** This is the implementation spec for the four flow
> changes (G1–G4) that move the protocol from "User-orchestrated" to the PDF's
> "Server-as-broker" model. The crypto layer (`packages/crypto`) needs **no** changes.
>
> What already conforms (no change): two key pairs, hashed+encrypted IDs, X.509 certs,
> RSA-4096, PRNG session key, AES-256-GCM, logs, icons, single user, forged-cert rejection.

## Why these changes (normative prose, not just the figure)

PDF §2 (normative):
- *"it sends a request to the Server."* → **G1** Service request (User → Server).
- *"Server forwards the User's request to TTP and sends a request for Server authentication."* → **G2**.
- *"sends to Server and User information that Server was correctly authenticated. After that, TTP
  sends to User a request for User authentication."* → **G3** (relay + redirect).
- *"sends OK response to User and Server, including the session key (encrypted with their public
  keys)."* → **G4** (Server receives its key from the TTP).

## Target sequence (faithful to Fig. 2)

```mermaid
sequenceDiagram
    participant U as User
    participant S as Server
    participant T as TTP

    Note over U,T: Enrollment (unchanged): U→T register, S→T register
    U->>S: requestService({ userId })           %% G1
    S->>T: auth.server({ serverId, cert, sig, requestId, userId })  %% G2
    Note over T: validate Server cert + signature; record pending(requestId)
    T-->>S: { ok, validatedAt }
    S-->>U: { serverAuthenticated, ttpUrl, requestId }   %% G3: Server auth OK + redirect
    U->>T: auth.user({ encryptedAuthMaterial incl. requestId })   %% (already direct)
    Note over T: validate User+Server cert + signature; create session;<br/>store encSessionKeyForServer keyed by requestId
    T-->>U: { sessionId, encryptedSessionKeyForUser }    %% User Auth OK + key (to User)
    S->>T: session.serverKey({ requestId })             %% G4: Server pulls its key from TTP
    T-->>S: { sessionId, encryptedSessionKeyForServer }
    rect rgb(250,238,218)
        U->>S: service.exchange (AES-256-GCM)            %% unchanged
        S-->>U: AES-256-GCM response
    end
    U->>S: closeSession                                  %% unchanged
```

---

## G1 — Service request (User → Server)

**New Server endpoint** `service.requestService`:

- Input: `{ userId: string }`.
- Behavior: generate `requestId = random.uuid()`; store a pending record
  `{ requestId, userId, createdAt }` in server state; then perform **G2** synchronously and
  return the **G3** payload.
- File: `apps/server/src/rpc.ts` (new handler), `apps/server/src/protocol.ts` (logic),
  `apps/server/src/state.ts` (pending-request map).

**Client** (`apps/client/src/lib/security-flow.ts`): `authenticateSession()` first calls
`service.requestService({ userId })` instead of `service.server.authenticate(...)` directly.

## G2 — Server forwards to TTP (`User, Server auth.`)

**Change TTP** `auth.server` input to carry the pending user context:

- Input adds `userId: string` (the user the Server expects to authenticate) — extend
  `ServerAuthenticationInput` in `apps/ttp/src/protocol.ts`.
- Behavior unchanged for cert/signature validation; **additionally** record a pending-auth
  entry keyed by `requestId`: `{ requestId, serverId, expectedUserId, validatedAt }` in a new
  `pendingAuths` map in `apps/ttp/src/state.ts`.
- The Server's `serverAuthenticationPayload` must include `userId` so the signature covers it
  (update both `apps/server/src/protocol.ts` and `apps/ttp/src/protocol.ts` payload builders to
  stay byte-identical).

**Server** (`apps/server/src/protocol.ts`): `requestService` calls `ttp.auth.server({ serverId,
certificatePem, requestId, userId, signature })` using the stored `requestId`.

## G3 — Relay `Server auth. OK` + `User Auth. redirect`

The `requestService` response returns:

```ts
{ serverAuthenticated: true, requestId, ttpBaseUrl }
```

- `ttpBaseUrl` lets the client know where to submit user auth (it already has it via env, so this
  is informational / explicit-redirect semantics).
- Client proceeds to `ttpProtocol.authenticateUser(request)` — **already direct, unchanged** —
  but now includes `requestId` in the signed `UserAuthenticationRequest` so the TTP can match it
  to the pending auth from G2.

**TTP `auth.user` change** (`apps/ttp/src/protocol.ts`):
- Look up `pendingAuths.get(requestId)`; require it exists and `expectedUserId === request.userId`
  and `serverId === request.serverId`. Reject otherwise (`UNAUTHORIZED`).
- Then validate certs + signature as today, create the session, and **store**
  `encryptedSessionKeyForServer` in the session record keyed by `requestId`/`sessionId`.
- Response to the User: `{ sessionId, encryptedSessionKeyForUser }` only (drop the server copy
  from the user-facing response).

## G4 — Server pulls its session key from the TTP

**New TTP endpoint** `session.serverKey`:

- Input: `{ requestId: string }` (or `{ sessionId }`).
- Auth: only the Server that owns the pending auth may fetch — bind it by requiring the Server to
  sign the request, or scope it to the `serverId` recorded in the pending entry. Minimal version
  for the demo: look up by `requestId`, return the stored `encryptedSessionKeyForServer`.
- Output: `{ sessionId, encryptedSessionKeyForServer }`.
- File: `apps/ttp/src/rpc.ts` + `apps/ttp/src/protocol.ts`.

**Server** (`apps/server/src/protocol.ts`): after the client has authenticated, the Server calls
`ttp.session.serverKey({ requestId })`, decrypts with its `exchangeKeyPair` private key (existing
`decryptSessionTicket`), and stores `sessionId` + `sessionKey` locally.

- **Trigger:** simplest is for the client to call a thin `service.server.fetchKey({ requestId })`
  after its own auth succeeds (one extra round trip), or the Server polls. Recommended:
  client-triggered `fetchKey` to keep it deterministic for the demo.
- **Remove** `server.acceptSession` (the old User→Server key relay) once `serverKey` works.

---

## State changes summary

| App | New / changed state | Purpose |
|---|---|---|
| TTP | `pendingAuths: Map<requestId, { serverId, expectedUserId, validatedAt }>` | Bind G2 → G3 |
| TTP | `SessionRecord` gains `encryptedSessionKeyForServer` (+ `requestId`) | Let Server pull its key (G4) |
| Server | `pendingRequests: Map<requestId, { userId, createdAt }>` | Track G1 service requests |

## Endpoint diff summary

| Endpoint | Change |
|---|---|
| `service.requestService` | **new** (G1) — triggers G2/G3, returns redirect payload |
| `service.server.fetchKey` | **new** (G4) — Server pulls its session key from TTP |
| `service.server.authenticate` | **removed** / folded into `requestService` |
| `service.server.acceptSession` | **removed** (User no longer relays the key) |
| `ttp.auth.server` | input gains `userId`; records `pendingAuths` |
| `ttp.auth.user` | matches `requestId` to pending; returns only the user's key |
| `ttp.session.serverKey` | **new** (G4) — returns `encryptedSessionKeyForServer` |

## Tests to update (`apps/ttp/src/index.test.ts`, `packages/crypto/tests`)

- `auth.server` fixtures must pass `userId` and the signature must cover it.
- New: `auth.user` rejects when `requestId` has no matching pending entry (replay/mismatch).
- New: `session.serverKey` returns a key that decrypts to the same `sessionKey` the User holds.
- Keep the existing forged-cert / invalid-signature negative tests (Task 4 — unchanged).

## Non-goals (explicitly out of scope)

- No change to `packages/crypto` (RSA-4096, AES-256-GCM, SHA-256, hybrid envelope all stay).
- Cert validation stays a stored-PEM lookup (in spec for Task 4 — see `deviations.md` §B1).
- `reset` endpoint stays as a demo safety net.

## Acceptance check (when implemented)

1. `bun test` green across `packages/crypto` and `apps/ttp`.
2. Manual run: GUI flow shows Service request → Server auth OK → user auth → encrypted exchange,
   with the Server obtaining its key from the TTP (visible in `logs/ttp.log`).
3. Forged-cert step still rejected.
