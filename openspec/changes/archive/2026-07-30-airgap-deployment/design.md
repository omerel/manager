## Context

Target: an air-gapped network with a managed Postgres (we get `DATABASE_URL`), a working Claude CLI environment (whatever endpoint/auth makes it run there is provided as env), and no internet. Delivery is `docker build` on a connected machine → `docker save` → media → `docker load`. The app already has everything needed for clean DB init (a complete, ordered `prisma/migrations/` history) and for populating a fresh system (data-portability bundles). The genuinely new pieces are the image, the entrypoint, and the first-admin bootstrap.

## Goals / Non-Goals

**Goals:**
- One image, Ubuntu 24.04, zero runtime downloads.
- First boot against an empty DB yields a working, log-in-able system with no manual SQL.
- Same entrypoint path for first init and upgrades.
- Agent works by pure env passthrough to the in-network Claude CLI.

**Non-Goals:**
- Orchestrating Postgres (managed externally), TLS termination / reverse proxy, horizontal scaling (the in-process scheduler and background jobs assume one instance), automated backup scheduling (manual via the existing export UI), CI pipelines.

## Decisions

**D1 — Multi-stage Dockerfile, both stages ubuntu:24.04.**
Builder: install Node 22 (NodeSource) + build-essential, `npm ci`, `prisma generate`, `next build`, `npm prune --omit=dev`. Runner: Node 22, copy app + pruned `node_modules` + `prisma/` (schema, migrations, prisma.config), install Chromium via `playwright install --with-deps chromium` plus `fonts-noto` (Hebrew PDF), and the Claude CLI via npm global install. *Why not `next build` standalone output:* we need the Prisma CLI and the full `prisma/` folder at boot anyway (`migrate deploy`), and `prisma` is already a production dependency — the simple copy keeps one coherent tree. *Why Ubuntu for the builder too:* identical glibc/ABI for anything native (pg, chromium deps).

**D2 — Entrypoint = wait → migrate → bootstrap → serve.**
`entrypoint.sh`: (1) wait-for-db loop using a tiny Node script over `pg` (no postgres-client apt package needed); (2) `npx prisma migrate deploy` — deterministic, idempotent, the production counterpart of the dev-time `migrate dev`; (3) `node docker/bootstrap-admin.mjs`; (4) `exec node_modules/.bin/next start -p ${PORT:-3000}`. `exec` keeps Next as PID-behaved child for clean signals.

**D3 — Bootstrap admin as plain Node + `pg`, not Prisma Client.**
The generated Prisma client is TypeScript source compiled into the Next build — unusable from a standalone boot script. The bootstrap script instead uses `pg` directly: `SELECT count(*) FROM "User"` → if 0, `INSERT` an admin with a locally generated unique id and a scrypt `salt:hex` hash **in the exact format of `lib/password.ts`**, from `ADMIN_USERNAME`/`ADMIN_PASSWORD`/`ADMIN_EMAIL`. Missing envs on an empty DB → loud warning, app still starts (data-portability full-restore can also supply users). *Why count==0 as the guard:* makes bootstrap trivially idempotent and never touches an initialized system.

**D4 — Agent = env passthrough, nothing else.**
`runClaude` already spawns with `{ ...process.env }`; the image just guarantees a `claude` binary on PATH. Operators set whatever `ANTHROPIC_*` / gateway variables their in-network CLI needs on the container, plus optional `AGENT_MODEL`. No app changes. `DEV_USER_SWITCH` is simply not set in production.

**D5 — Persistence contract: `/app/uploads` volume; everything else stateless.**
DB state lives in the managed Postgres; session signing and secret encryption need only `APP_SECRET` (operators must keep it stable across upgrades — noted in docs); temp agent snapshots live in container tmp and are disposable.

**D7 — `/healthz` with a DB touch.**
Public route: `SELECT 1` via the existing pg pool → 200 `{ok:true}`; any failure → 503. One endpoint serves both OpenShift probes (liveness = app up; readiness = DB reachable). Unauthenticated by design — it leaks nothing but liveness.

**D8 — OpenShift restricted-SCC compatibility (arbitrary UID, group 0).**
The runner stage prepares every writable path for a random UID: `chgrp -R 0 /app && chmod -R g=u` on app, uploads, and a dedicated `HOME=/app/.home` (the Claude CLI writes config/state under HOME — a read-only or nonexistent HOME breaks agent runs). No `USER`-id assumptions anywhere; `PORT` stays configurable (default 3000, >1024 so non-root binds fine). *Why:* OpenShift ignores the Dockerfile's USER id under restricted SCC — group-0 permissions are the supported pattern.

**D9 — Build-time-only font fetch; zero-external-refs audit.**
`next/font` downloads Rubik once at build (connected machine) and self-hosts the woff2 in `.next/static` — verified: the served HTML references zero external origins. The E2E verification includes an automated audit (scan served pages for `https?://` off-origin) so a future CDN tag fails the check instead of failing in the airgap.

**D6 — Ops surface: compose example + README runbook.**
`deploy/docker-compose.example.yml` (app service only — DB is managed) + env example listing every variable with commentary; README gains: build, save/load, first-run checklist (login as bootstrap admin → import bundle), upgrade flow (pull new image, same volume/envs, entrypoint migrates), and the single-instance constraint.

## Risks / Trade-offs

- **Image size** (Chromium + fonts + node_modules ≈ 1.5–2GB) → acceptable for offline media delivery; standalone-output slimming is a later optimization.
- **`migrate deploy` runs on every boot** → by design; on failure the container exits loudly rather than serving a half-migrated app.
- **Bootstrap hash format duplication** (script mirrors `lib/password.ts`) → verified by an integration test that logs in with the bootstrapped credentials through the real app.
- **Single-instance assumption** (in-process scheduler, `after()` jobs) → documented; scaling out later requires the queue upgrade already noted in async-operations' design.
- **Claude CLI version drift** vs. the one working in the airgap → the baked CLI is self-contained; if the org standard differs, the binary can be bind-mounted over ours (documented escape hatch).

## Migration Plan

1. Dockerfile + entrypoint + bootstrap script → 2. compose + env examples + README → 3. E2E verification: build image, `docker network` with a fresh empty Postgres, first boot (schema + admin + login + person + PDF export), reboot (idempotence), volume persistence across container replacement. No app migrations.

## Open Questions

- ~~Health endpoint~~ — resolved: OpenShift pods, `/healthz` is in scope (D7), including arbitrary-UID compatibility (D8).
