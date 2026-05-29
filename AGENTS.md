# AGENTS.md

## Cursor Cloud specific instructions

### Product

BSK PG Trusted Third Party demo: a Bun monorepo with three apps (`apps/client`, `apps/server`, `apps/ttp`). No database or external services—everything is in-memory.

### Toolchain

- **Bun 1.3.12** is pinned in `mise.toml`. Use `mise trust` (once per clone) and `mise install` before `bun install`.
- Ensure `mise` is on `PATH` (`~/.local/bin`) and shims are active (`eval "$(mise activate bash)"` or shims in `PATH`).

### Common commands (repo root)

See `README.md` for the canonical list. Quick reference:

| Task | Command |
|------|---------|
| Install deps | `bun install` |
| Lint (static) | `bun run typecheck` (`tsc --noEmit` per workspace; no ESLint) |
| Tests | `bun run test` |
| Build | `bun run build` |
| Full gate | `bun run ready` (typecheck → test → build) |
| Dev (all apps) | `bun run dev` |

### Services and ports

| App | Port | Health / UI |
|-----|------|-------------|
| Client | 3000 | `http://localhost:3000/` |
| TTP | 3001 | `http://localhost:3001/api/health` |
| Server | 3002 | `http://localhost:3002/api/health` |

Start **TTP first**, then Server, then Client. `bun run dev` runs all three in parallel.

For long-running dev in Cloud Agent VMs, prefer a **tmux** session (e.g. `bsk-dev`) rather than a one-shot background shell.

### Manual E2E demo

Follow `docs/demo-checklist.md`: register roles → start session → exchange data in the Client UI. Automated `bun run test` does not require the live stack (TTP tests use the Hono app in-process; Client tests mock `fetch`).

### Optional

- Docker demo: `docker compose up --build` (same three ports; see `docker-compose.yml`).
- Doxygen: `doxygen Doxyfile` (not required for runtime).

### Browser UI note

The dashboard uses TanStack Query (`useQuery` on `/_guard/`). If the Client shows a “No QueryClient set” error in the browser, wrap the guarded layout with `QueryClientProvider` using the `queryClient` from router context (`#/integrations/tanstack/query/root-provider.tsx`). API backends and `bun run ready` work without the UI.
