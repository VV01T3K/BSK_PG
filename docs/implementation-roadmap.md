# Three-Part Roadmap for the Client, Server, and TTP Demo

## Summary

This project demonstrates a Trusted Third Party (TTP) authentication environment with three applications: a browser-facing Client, a protected service Server, and a TTP authority. Docker Compose runs the applications as separate services for the final VM-like demo.

## Part 1: TTP, Crypto, and Registration

- Replace starter TTP demo routes with `/api/health`, `/api/ttp/public-key`, `/api/register`, `/api/auth/server`, `/api/auth/user`, `/api/session/close`, and `/api/logs`.
- Generate RSA-4096 keys, SHA-256 public IDs, X.509 certificates, and AES-256 session keys.
- Keep TTP identities, certificates, sessions, and timestamped logs in memory for the presentation demo.
- Acceptance criteria: User and Server can register, receive certificates, and TTP logs show each operation.

## Part 2: Client and Protected Server Flow

- Use `apps/client` as a browser SPA and `apps/server` as the protected service API.
- Keep Client key/session material in memory and perform User-side RSA/AES operations with browser Web Crypto.
- Add controls for registration, service authentication, encrypted data exchange, forged certificate rejection, and MITM/tamper rejection.
- Show status icons/messages, current session/certificate state, timestamped event timeline, and encrypted/plaintext service evidence.
- Acceptance criteria: one screen can demonstrate the full valid path and both attack/failure paths.

## Part 3: Docker, Tests, and Report Assets

- Add Docker Compose services for `client` on port `3000`, `ttp` on port `3001`, and `server` on port `3002`.
- Add tests for registration, certificate validation, forged certificate rejection, AES-GCM round trip, failed authentication, and encrypted service exchange.
- Add README instructions, Doxygen configuration, and a final report skeleton with code-listing and bibliography sections.
- Acceptance criteria: `bun run ready` passes locally and `docker compose up --build` starts the demo environment.

## Requirement Mapping

| Requirement | Implementation evidence |
|---|---|
| TTP | `apps/ttp` Hono authority service |
| User/Client | Browser application in `apps/client` |
| Server | Protected service API in `apps/server` |
| RSA 4096 | TTP CA key and generated role key pairs |
| X.509 | Certificates issued and validated by TTP |
| AES 256 | Session key and AES-GCM message exchange |
| Logs | Client, Server, and TTP event timelines |
| Forged certificate demo | UI attack action and test coverage |
| MITM resistance demo | UI tamper action and AES-GCM failure |
| VM-like environment | Docker Compose services |

## Demo Commands

```sh
bun install
bun run ready
bun run dev
```

```sh
docker compose up --build
```

Open `http://localhost:3000` for the Client UI. The Server health endpoint is available at `http://localhost:3002/api/health`, and the TTP health endpoint is available at `http://localhost:3001/api/health`.
