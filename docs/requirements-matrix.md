# BSK/SCS Project Requirements Matrix

## Encryption Approach Decision

The project uses one cryptographic approach: hybrid encryption.

RSA-4096 is still present, but only as part of the hybrid mechanism, certificates, digital signatures, and session-key delivery. Public-key protocol payloads are encrypted with an RSA-OAEP-SHA-256 + AES-256-GCM hybrid helper. The final Client-Server service exchange uses the AES-256 session key issued by the TTP.

There is no separate "normal RSA" application mode.

## Requirement Matrix

| # | Requirement from task | Current status | Evidence in project | Missing / action needed | Added beyond requirement |
|---|---|---|---|---|---|
| 1 | Three independent applications: User/Client, Server, TTP. | Done | `apps/client`, `apps/server`, `apps/ttp` | Present them as three services during demo. | Shared `packages/crypto` and `packages/rpc` keep common code consistent. |
| 2 | User and Server register/login to TTP before communication. | Done | `registerPrincipals`, `registerProtectedServer`, `registerPrincipal`. | None. | UI exposes this as step 1. |
| 3 | User and Server generate IDs. | Done | User ID in `apps/client/src/lib/security-flow.ts`; Server ID in `apps/server/src/protocol.ts`. | None. | IDs are randomized before hashing. |
| 4 | Public IDs generated with secure hash algorithm. | Done | SHA-256 helper in `packages/crypto/src/crypto.ts`. | None. | Certificate fingerprints also use SHA-256 for UI evidence. |
| 5 | IDs encrypted with TTP public key and sent to TTP. | Done | Registration uses `rsa.publicKey(ttpPublicKeyPem).encrypt(...)`. | None. | Public-key encryption is hybrid for all payload sizes, not plain RSA-only. |
| 6 | User and Server generate two RSA key pairs and send public keys to TTP. | Done | `authKeyPair` and `exchangeKeyPair` generated for both roles. | None. | Auth key signs authentication claims; exchange key protects certificates/session tickets. |
| 7 | TTP issues X.509 public key certificates. | Done | `packages/crypto/src/certificates.ts`, `apps/ttp/src/certificates.ts`. | None. | CA certificate, cert extensions, and certificate tests are implemented. |
| 8 | Client requests service from Server. | Done | "Use service" UI step and `service.service.exchange`. | None. | Demo service uses a protected grade-summary style payload. |
| 9 | Server authenticates with TTP. | Done | `authenticateProtectedServer` calls `ttp.auth.server`. | In report, explain this step clearly because the UI orchestrates the flow. | Server signs the authentication claim with its auth private key. |
| 10 | TTP validates Server request/certificate. | Done | `authenticateServerCertificate` validates certificate and signature. | None. | Invalid server signature test exists. |
| 11 | TTP validates User authentication data. | Done | `authenticateUserForServer` decrypts, validates certificates, and verifies signature. | None. | Invalid user signature test exists. |
| 12 | TTP sends OK and session key encrypted for User and Server. | Done | `encryptedSessionKeyForUser`, `encryptedSessionKeyForServer`. | None. | Session ticket includes both `sessionId` and `sessionKey`. |
| 13 | Authenticated Client-Server data exchange encrypted with session key. | Done | AES session encryption in `packages/crypto`; service exchange in `apps/server/src/protocol.ts`. | Demo this live. | Server returns only encrypted response payload; client decrypts locally. |
| 14 | Session closes after service; next request repeats authentication. | Done | `closeSession` in Client, Server, and TTP flow. | Demo close session after exchange. | Reset is also available as a presentation safety net. |
| 15 | Client application with GUI or web application. | Done | React/TanStack/Vite client in `apps/client`. | None. | Step cards, current-state panel, and icons are implemented. |
| 16 | RSA algorithm with 4096-bit key. | Done | `RSA_BITS = 4096` in crypto and certificate generation. | None. | RSA-OAEP-SHA-256 is used for wrapping hybrid keys. |
| 17 | Pseudorandom generator for session keys. | Done | `random.sessionKey()` uses `node-forge` random bytes. | None. | Randomness is covered by tests. |
| 18 | AES session key should be 256-bit. | Done | Session key is 32 bytes; tests assert length. | None. | AES-GCM mode adds integrity/authentication tag. |
| 19 | Status/message icons for application state. | Done | Lucide icons in `apps/client/src/routes/index.tsx` and `StepCard`. | None. | Separate icons for register, authenticate, service, forged cert, close/reset. |
| 20 | Server and TTP save logs with timestamps. | Done | `packages/rpc/src/log.ts`; Server/TTP call `log(...)`. | During demo, show `logs/server.log` and `logs/ttp.log`. | Logs are JSON-line structured with actor/level/event/details. |
| 21 | Only one User expected. | Done | Client state stores one current user/session. | None. | Reset can clear the single-user demo state quickly. |
| 22 | Available AES/RSA/SHA libraries may be used. | Done | Uses `node-forge`. | None. | Library usage is wrapped behind a small local crypto API. |
| 23 | Cipher parameters can be constants. | Done | RSA/AES/GCM constants in `packages/crypto/src/crypto.ts`. | None. | Centralized constants avoid inconsistent app settings. |
| 24 | Any programming language/platform allowed. | Done | TypeScript, Bun, React. | None. | Monorepo scripts support test/typecheck/build. |
| 25 | At least two VMs for Server and TTP. | Done for project scope | Teacher accepted Docker Compose; `docker-compose.yml` runs separate `server` and `ttp` services. | In report/presentation, state Docker Compose is the accepted VM-like environment. | Docker Compose also runs Client for one-command demo startup. |
| 26 | Demonstrate correct User-Server authentication with TTP. | Done in code | UI flow and TTP tests cover registration/auth/session issue. | Prepare presentation sequence. | Automated tests verify session-key distribution. |
| 27 | Demonstrate Client-Server data transfer. | Done in code | Protected service exchange sends encrypted request and encrypted response. | Prepare presentation sequence. | AES tamper/session mismatch tests exist in crypto package. |
| 28 | Demonstrate incorrect validation for forged certificate / MITM resistance. | Done in code | Forged certificate UI step; TTP negative test. | Show live during presentation. | Also rejects invalid auth signatures. |
| 29 | Report includes brief description of performed tests. | Missing report | Tests exist in `packages/crypto/tests` and `apps/ttp/src/index.test.ts`. | Write report test section. | Test suite gives ready material for report. |
| 30 | Report includes partial code listings and explanations. | Missing report | Main functions are separated in crypto/protocol modules. | Write report listings section. | Good listing candidates are already isolated. |
| 31 | Full code documentation with Doxygen. | Partial / pending | `Doxyfile` exists. | Generate/review Doxygen later. | Doxygen config is already present. |
| 32 | University GitLab repo with correct naming and teacher Maintainer access. | External / needs confirmation | Local Git repo exists. | Confirm remote name, push, and teacher access on `git.pg.edu.pl`. | `.gitignore` avoids logs/build output. |
| 33 | Control meeting: certificate generation, two identities authentication, basic Client/Server/TTP. | Ready in code | UI and tests cover basic flow. | Prepare short demo script. | Reset helps recover during live demo. |
| 34 | Final report: task, functionality, listings, Doxygen, bibliography, GitLab. | Missing report | Codebase has implementation material. | Write report and bibliography. | Requirements matrix can be used as report checklist. |

## Additional Things Currently Added

| Added item | Why it exists | Keep? |
|---|---|---|
| Hybrid-only public encryption API | Avoids presenting two approaches; handles large PEM/certificate payloads safely. | Keep. |
| RSA/SHA-256 signatures using `authKeyPair` | Makes the required second RSA key pair meaningful in authentication. | Keep. |
| AES-GCM instead of a simpler AES mode | Adds integrity protection for encrypted service data. | Keep. |
| Encrypted Server response only | Avoids leaking plaintext in the RPC response. | Keep. |
| Reset button / Server reset endpoint | Presentation safety net if the flow gets stuck. | Keep for demo, explain it is not part of the security protocol. |
| Docker Compose environment | Teacher accepted it as VM-like environment. | Keep. |
| Automated tests | Supports report testing section and reduces demo risk. | Keep. |
| Shared crypto/RPC packages | Reduces duplicated code across Client, Server, and TTP. | Keep. |
| JSON-line structured logs | Meets timestamped log requirement cleanly. | Keep. |
| Doxygen config | Needed for documentation requirement. | Keep, finish later. |

## Missing Summary

1. Final report: task description, tests, code listings, bibliography.
2. Doxygen generation/review.
3. University GitLab confirmation: correct repository name, pushed code, teacher as Maintainer.
4. Presentation script: normal flow, encrypted exchange, forged certificate rejection, logs, Docker Compose environment.
