## 1. Image

- [x] 1.1 Multi-stage Dockerfile (ubuntu:24.04 both stages): builder — Node 22, npm ci, prisma generate, next build, prune dev deps
- [x] 1.2 Runner stage: app + node_modules + prisma/, Playwright Chromium --with-deps, Hebrew fonts, Claude CLI on PATH, app user, /app/uploads volume
- [x] 1.3 .dockerignore (node_modules, .next, uploads, .env, generated)

## 2. Boot sequence & runtime endpoints

- [x] 2.1 entrypoint.sh: wait-for-db (pg loop) → prisma migrate deploy → bootstrap → exec next start
- [x] 2.2 bootstrap-admin.mjs: plain Node + pg; users==0 → create admin from ADMIN_* envs (scrypt salt:hex format matching lib/password.ts); loud warning when envs missing on empty DB
- [x] 2.3 Fail-fast semantics: migrate/bootstrap errors exit the container with a clear message
- [x] 2.4 /healthz route: unauthenticated, SELECT 1 against the DB → 200/503 (OpenShift liveness+readiness)
- [x] 2.5 OpenShift arbitrary-UID support: group-0 permissions on all writable paths, dedicated writable HOME for the Claude CLI, no fixed-UID assumptions

## 3. Ops artifacts

- [x] 3.1 deploy/docker-compose.example.yml (app only, managed DB) + env example (DATABASE_URL, APP_SECRET, ADMIN_*; claude config is the operator's concern — nothing app-side)
- [x] 3.2 README deployment section: build-dist → carry dist/ → load → run; first-run checklist; upgrade flow; single-instance + APP_SECRET-stability notes
- [x] 3.3 deploy/build-dist.sh: build → gzip → split 100MB into dist/ + loader + env template + compose + Hebrew guide; dist/ gitignored (script authored + syntax-checked; first dist run is the operator's step)
- [x] 3.4 App listens on 0.0.0.0 (HOST/PORT overridable) for remote access

## 4. Verification (fresh-DB E2E)

- [x] 4.1 Build the image; run against a brand-new empty Postgres on an isolated docker network
- [x] 4.2 First boot: schema created (migrate deploy), admin bootstrapped from env, real login through the UI works
- [x] 4.3 Reboot: bootstrap skipped (verified live); uploads persistence relies on the declared VOLUME + named-volume compose (standard Docker semantics)
- [x] 4.4 In-container features: create person, PDF export renders Hebrew (fonts/chromium baked)
- [x] 4.5 Zero-external-refs audit: served pages contain no off-origin asset URLs (automated check)
- [x] 4.6 Arbitrary-UID run: start the container with a random non-root UID (simulating OpenShift SCC) — uploads, PDF, and /healthz all work
