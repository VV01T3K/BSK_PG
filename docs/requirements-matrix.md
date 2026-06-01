# BSK/SCS Project Requirements Matrix

## Normal vs hybrid encryption approach

We do not need to present two separate approaches.

The project should use one main protocol approach: a hybrid cryptographic flow. RSA is used for identity protection, certificate/key handling, and session-ticket delivery. AES-256 is used for the actual client-server service data after the TTP issues the session key.

This matches the task better than a pure RSA/"normal" approach because the task explicitly says that exchanged data after authentication must be encrypted with the session key, and the session key should use AES-256. Pure RSA is also not suitable for larger service payloads. The current code can keep the direct RSA helper for small protocol payloads, but the demo/report should describe the implemented solution as hybrid.

## Requirement Matrix

| # | Requirement from task | Current status | Evidence in project | Missing / action needed | Extra added beyond requirement |
|---|---|---|---|---|---|
| 1 | Three independent applications: User/Client, Server, TTP. | Done | `apps/client`, `apps/server`, `apps/ttp` | None for code. In presentation, show them as three services. | Shared monorepo packages: `@bsk/crypto`, `@bsk/rpc`. |
| 2 | User and Server must register/login to TTP before communication. | Done | Client flow registers user and server in `apps/client/src/lib/security-flow.ts`; TTP registration in `apps/ttp/src/protocol.ts`; server registration in `apps/server/src/protocol.ts`. | None. | UI step for registration. |
| 3 | User and Server generate IDs. | Done | User ID generated in `apps/client/src/lib/security-flow.ts`; server ID generated in `apps/server/src/protocol.ts`. | None. | IDs are randomized per registration. |
| 4 | Public IDs must be generated using secure hash algorithm. | Done | SHA-256 helper in `packages/crypto/src/crypto.ts`; used for user/server IDs. | None. | Fingerprint helper for UI/status evidence. |
| 5 | IDs must be encrypted with TTP public key and sent to TTP. | Done | RSA encryption during registration in client/server protocol code; TTP decrypts in `apps/ttp/src/protocol.ts`. | None. | TTP exposes public key endpoint. |
| 6 | User and Server generate two RSA key pairs and send public keys to TTP. | Done | `authKeyPair` and `exchangeKeyPair` generated in client/server registration flows. | Auth key pair is stored/sent but not heavily used later; explain that exchange key pair protects session tickets. | Separate auth/exchange keys, which is stronger separation than one key pair. |
| 7 | TTP issues X.509 public key certificates. | Done | Certificate authority and principal cert creation in `packages/crypto/src/certificates.ts`; TTP issues in `apps/ttp/src/certificates.ts` / `apps/ttp/src/protocol.ts`. | None. | CA certificate support and certificate extensions. |
| 8 | Client can request service from Server. | Done | UI step "Use service" and service call in `apps/client/src/lib/security-flow.ts`; server exchange in `apps/server/src/protocol.ts`. | Current service is a demo protected message, not a rich real service. Acceptable, but report should describe it clearly. | "Protected grade-summary service" example payload. |
| 9 | Server forwards/starts authentication with TTP. | Mostly done | Client calls server authentication step; server calls TTP in `apps/server/src/protocol.ts`. | In strict sequence-diagram terms, client orchestrates some steps from UI. In report/presentation, explain the server performs its own TTP certificate authentication. | Clear UI step separation. |
| 10 | TTP validates Server request/certificate. | Done | `authenticateServerCertificate` in `apps/ttp/src/protocol.ts`; certificate checks in `apps/ttp/src/certificates.ts`. | None. | Test coverage for server/user certificate validation path. |
| 11 | TTP asks/validates User authentication data. | Done | User auth request encrypted to TTP; TTP decrypts and validates in `authenticateUserForServer`. | None. | User auth material uses hybrid RSA+AES because certificate payload is large. |
| 12 | TTP sends OK to User and Server with session key encrypted with their public keys. | Done | `encryptedSessionKeyForUser` and `encryptedSessionKeyForServer` in `apps/ttp/src/protocol.ts`; client/server decrypt tickets. | None. | Session ticket includes session id and expiry. |
| 13 | After authentication, User and Server exchange data encrypted using session key. | Done | AES-GCM session encryption in `packages/crypto/src/crypto.ts`; client exchange in `apps/client/src/lib/security-flow.ts`; server decrypts/responds in `apps/server/src/protocol.ts`. | The client currently does not display/decrypt the encrypted server response in the UI; useful improvement before final demo. | AES-GCM auth tag protects against tampering. |
| 14 | Session closes after service; next request repeats authentication. | Done | Close flow in client, TTP, and server protocol. | UI supports close/reset. Need demonstrate during presentation. | Session expiry timestamp is also tracked. |
| 15 | Client application should have GUI or be web app. | Done | React/TanStack/Vite client in `apps/client`. | None. | Step-by-step status dashboard. |
| 16 | RSA algorithm with 4096-bit key must be used. | Done | `RSA_BITS = 4096` in `packages/crypto/src/crypto.ts` and certificate code. | None. | RSA-OAEP with SHA-256 for encryption padding/hash. |
| 17 | Pseudorandom generator must generate session keys. | Done | `random.sessionKey()` uses forge random bytes in `packages/crypto/src/crypto.ts`. | None. | Tests verify distinct random output and key length. |
| 18 | AES session key should be 256-bit. | Done | 32-byte key in `packages/crypto/src/crypto.ts`; tests assert 32 bytes. | None. | AES-GCM mode with 128-bit auth tag. |
| 19 | Status/message icons must present application state. | Done | Lucide icons and completion states in `apps/client/src/routes/index.tsx` and `apps/client/src/components/step-card.tsx`. | Could add connection/log status icons if you want a stronger visual demo. | Separate icons for register, auth, service, forged cert, close/reset. |
| 20 | Server and TTP must save logs with timestamps. | Done | File logger in `packages/rpc/src/log.ts`; server and TTP log state in `apps/server/src/state.ts`, `apps/ttp/src/state.ts`. | Need demonstrate created `logs/server.log` and `logs/ttp.log` during final presentation. | JSON-line structured logs with actor/level/event/details. |
| 21 | Only one User is expected. | Done | Client state stores one registered user/session. | None. | Simpler demo flow aligned with requirement. |
| 22 | Libraries for AES, RSA, SHA may be used. | Done | Uses `node-forge`. | None. | Crypto behavior wrapped in shared internal package. |
| 23 | Cipher parameters can be constants in each application. | Done | Constants for RSA bits, AES key bytes, GCM IV/tag. | None. | Centralized crypto constants in shared package. |
| 24 | Any programming language/platform allowed. | Done | TypeScript/Bun/React stack. | None. | Docker Compose demo support. |
| 25 | At least two VMs must be created, most suitable Server and TTP. | Partial / external | `docker-compose.yml` has separate `server` and `ttp` services plus client. | Real VM requirement still needs presentation setup or teacher acceptance that containers emulate VM-like services. Safer final demo: run Server and TTP in two VMs, or document Docker Compose as local emulation plus prepare VM screenshots. | Docker Compose can start all services quickly. |
| 26 | Demonstrate correct user-server authentication with TTP. | Done in code | End-to-end UI flow and TTP tests. | Need final presentation script/screenshots. | UI shows four demo steps. |
| 27 | Demonstrate data transfer between Client and Server. | Done in code | Protected service exchange. | Improve UI evidence by showing request/response ciphertext/plaintext summary. | Tests cover AES round-trip/tamper cases. |
| 28 | Demonstrate incorrect validation when certificate is forged / MITM resistance. | Done in code | "Forged certificate" UI step; TTP test rejects forged user certificate. | Need show this live during presentation and describe the attack. | Dedicated negative-path test and UI control. |
| 29 | Report must include brief description of performed tests. | Missing document | Automated tests exist in `packages/crypto/tests` and `apps/ttp/src/index.test.ts`. | Write report section describing auth validation, forged certificate, AES encryption/decryption, network checks. | Test suite already gives material for report. |
| 30 | Report must include partial code listings with main functions and explanations. | Missing document | Main functions exist in protocol/crypto files. | Add report listings for registration, certificate validation, session key issue, AES service exchange, forged cert rejection. | Code is cleanly separated, easy to quote. |
| 31 | Full code documentation must be created using Doxygen. | Partial | `Doxyfile` exists and generated output exists in `docs/doxygen-output`. | `Doxyfile` references missing `docs/implementation-roadmap.md`; add missing docs or update `INPUT`. Add more Doxygen comments if teacher expects richer docs. | Doxygen output directory already present. |
| 32 | Use University GitLab repository with required name pattern. | External / unknown | Local repo exists. | Confirm repo is on `git.pg.edu.pl`, named `[SCS_GN0000_Surname1_Surname2]`, and teacher is Maintainer. | `.gitignore` exists. |
| 33 | Control meeting: show certificate generation, two identities authentication, basic client/server/TTP. | Ready in code | Existing UI and tests cover this. | Need prepare short demo sequence and make sure GitLab sharing is done. | Docker Compose/local demo simplifies control meeting. |
| 34 | Final report: description of task, functionality, code listings, Doxygen, bibliography, GitLab. | Missing document | Some raw material exists in README/tests/code. | Write final report and bibliography. | Requirements matrix can be used as report checklist. |

## Current Added Features Beyond The Minimum

| Added item | Why it helps |
|---|---|
| React web GUI with step cards and icons | Makes presentation flow clearer than a command-line-only client. |
| Docker Compose with separate client/server/TTP services | Gives a repeatable demo environment. |
| Shared crypto package | Keeps RSA/AES/SHA implementation consistent across apps. |
| Shared RPC/logging package | Reduces duplicated transport/log code. |
| AES-GCM instead of plain AES mode | Adds integrity/authentication tag for encrypted service data. |
| RSA-OAEP with SHA-256 | Stronger padding choice than raw/textbook RSA. |
| Session IDs and expiry timestamps | Makes session handling more realistic. |
| Close/reset flow | Lets the demo repeat the authentication process cleanly. |
| Automated crypto and TTP tests | Supports the report's testing section. |
| Forged certificate negative test in UI and test suite | Directly supports the 6-point MITM/forgery demonstration requirement. |

## Main Things Still Missing

1. Confirm/run the Server and TTP in two actual VMs, or get acceptance for Docker Compose as the emulated environment.
2. Write the final report with test descriptions, code listings, and bibliography.
3. Make sure University GitLab repository naming/sharing requirements are satisfied.
4. Clean up Doxygen inputs: either add `docs/implementation-roadmap.md` or remove it from `Doxyfile`.
5. Consider improving the UI to show encrypted service response evidence, not only "exchange complete".
