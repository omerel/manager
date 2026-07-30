## Why

The system runs only as a dev server on the developer's machine. The target runtime is an **air-gapped network**: no internet, a managed Postgres, and a local Claude CLI already available inside the network. We need a self-contained Docker image (Ubuntu 24.04 base) that carries every dependency, configures itself from environment variables at run time, and — the key unknown — initializes a fresh database correctly on first boot without human SQL.

## What Changes

- **Self-contained Docker image (ubuntu:24.04)** — multi-stage build that bakes in: Node 22, the built Next.js app with production `node_modules` (including the Prisma CLI + engines, so nothing downloads at runtime), Playwright Chromium + system deps + Hebrew fonts (PDF export), and the Claude CLI. Built on a connected machine, delivered by `docker save` → media → `docker load`.
- **Self-initializing entrypoint** — on every container start:
  1. wait for `DATABASE_URL` to accept connections;
  2. `prisma migrate deploy` — on an empty DB this creates the full schema; on an existing DB it applies only new migrations; otherwise a no-op (first-init and upgrades are the same path);
  3. **bootstrap admin**: if the users table is empty, create the first admin from `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_EMAIL` envs (idempotent — skipped once any user exists);
  4. start the server.
- **Runtime configuration via env only** — `DATABASE_URL`, `APP_SECRET`, bootstrap-admin vars, and passthrough of the Claude CLI's own env (`ANTHROPIC_*`, `AGENT_MODEL`) — the agent spawns with the container's environment, so whatever makes `claude` work in the air-gapped network flows through untouched.
- **Persistence contract** — `/app/uploads` declared as a volume (attachments, photos, logo); DB lives in the managed Postgres.
- **Ops artifacts** — example `docker-compose.yml` + env file, and a README deployment section covering build → save → load → run and the upgrade flow (new image, same entrypoint).
- **Populating the system** after first boot uses the existing data-portability capability: log in as the bootstrap admin and import a configuration bundle (fresh setup) or a full backup (environment migration).

## Capabilities

### New Capabilities
- `deployment`: Containerized, air-gap-safe runtime — env-only configuration, self-initializing database on first boot, idempotent bootstrap admin, uploads persistence, and no runtime network fetches.

### Modified Capabilities
<!-- None: application behavior is unchanged; this packages it. -->

## Impact

- **New files**: `web/Dockerfile`, `web/docker/entrypoint.sh`, `web/docker/bootstrap-admin.mjs` (plain Node + pg — no TS/Prisma-client dependency at boot), `deploy/docker-compose.example.yml` + env example, README section. No schema changes, no app-code changes beyond none-or-trivial.
- **Constraint honored**: zero network access at runtime — everything resolved at image build time.
- **Verified by**: building the image and running it against a brand-new empty Postgres — schema created, admin bootstrapped from env, login/export/PDF all working; second boot proves idempotence.
