# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Bun monorepo with two apps:
- **`apps/server`** (port 3000): React SPA via TanStack Start + Vite
- **`apps/ttp`** (port 3001): Hono HTTP API backend

Both services must run together; the frontend's startup guard (`_guard/route.tsx`) blocks until the Hono API responds at `/api/startup`.

### Tool versions

Managed by [mise](https://mise.jdx.dev). The pinned runtime is **Bun 1.3.12** (see `mise.toml`).

Activate mise in your shell before running commands:

```bash
eval "$(/home/ubuntu/.local/bin/mise activate bash)"
```

### Common commands

See `README.md` for full list. Quick reference:

| Task | Command |
|------|---------|
| Install deps | `bun install` |
| Dev (both apps) | `bun run dev` |
| Typecheck | `bun run typecheck` |
| Test | `bun run test` |
| Build | `bun run build` |
| All checks | `bun run ready` |

### Gotchas

- `@tanstack/devtools-vite` is a dev dependency of `apps/server`; it's imported in `vite.config.ts`. If `bun install` doesn't resolve it, run `bun add -D @tanstack/devtools-vite --cwd apps/server`.
- No dedicated lint CLI script exists — formatting is handled by OXC via VS Code extension. Typecheck (`bun run typecheck`) is the primary static analysis command.
- The `ttp` app uses `bun run --hot` for hot reload; the `server` app uses Vite's built-in HMR.
- No database or external services are required; all data is in-memory.
