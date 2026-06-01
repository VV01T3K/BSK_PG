# BSK PG Trusted Third Party Demo

Three-application Client, Server, and Trusted Third Party demo for the Security of Computer Systems project.

## Development

Install dependencies:

```bash
bun install
```

Check the workspace:

```bash
bun run ready
```

Run the local demo:

```bash
bun run dev
```

Open the Client UI at `http://localhost:3000`. The protected Server API listens on `http://localhost:3002`, and the TTP API listens on `http://localhost:3001`.

Run tests only:

```bash
bun run test
```

Build the monorepo:

```bash
bun run build
```

## Docker Compose Demo

Docker Compose is used as the final VM-like environment:

```bash
docker compose up --build
```

Services:

- `client`: TanStack Start SPA Client application on port `3000`
- `server`: protected service Server application on port `3002`
- `ttp`: Trusted Third Party authority on port `3001`

## Documentation

- Requirements matrix: `docs/requirements-matrix.md`
- Doxygen config: `Doxyfile`

Generate Doxygen output with:

```bash
doxygen Doxyfile
```
