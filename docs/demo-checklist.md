# Demo Checklist

## Before the Presentation

- Run `bun install`.
- Run `bun run ready`.
- Run `doxygen Doxyfile`.
- Run `docker compose up --build`.
- Open the Client UI at `http://localhost:3000`.

## What to Show

1. TTP and Server health endpoints:
   - `http://localhost:3001/api/health`
   - `http://localhost:3002/api/health`
2. In the Client UI, click **Register roles**.
3. Show User and Server IDs and certificate fingerprints.
4. Click **Start session**.
5. Show the active AES session ID and expiry timestamp.
6. Click **Exchange data**.
7. Show plaintext evidence and encrypted AES-GCM envelopes.
8. Click **Forged cert**.
9. Show that TTP rejects the forged certificate.
10. Click **Tamper**.
11. Show that the Server rejects the modified ciphertext.
12. Click **Close session**.

## Submission Items

- GitLab repository with code, not ZIP.
- Teacher invited as Maintainer.
- `docs/final-report.md`.
- Doxygen output generated locally from `Doxyfile`.
- Docker Compose demo working.
