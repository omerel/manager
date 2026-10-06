# ניהול קריירה / manager — operating manual

**Audience: an AI coding agent.** This file is procedure, not prose. It tells you
what to run, what the output looks like when it worked, and which failures are
expected to be confusing. For *what the product does*, read
[`web/README.md`](web/README.md) — that one is written for people and describes
capabilities, not commands.

Everything below was verified by running it on the development machine.

---

## 0. Orientation

| | |
|---|---|
| App code | `web/` — **every command in this file runs from `web/` unless stated otherwise** |
| Stack | Next.js 16 (App Router), React 19, TypeScript, Prisma 7 (`PrismaPg` adapter), PostgreSQL 16 |
| UI | Hebrew / RTL throughout. Identifiers and comments are English; user-facing strings are Hebrew |
| Dev server | `http://localhost:4321` |
| Dev database | PostgreSQL on **5433** (not 5432) |
| Specs | `openspec/` — see §6. The repo is driven by OpenSpec, not by ad-hoc commits |
| Air-gap delivery | `deploy/` + `web/Dockerfile` + `web/docker/` — see §5 |

### Read this before writing Next.js code

`web/AGENTS.md` says, in full:

> **This is NOT the Next.js you know.** This version has breaking changes — APIs,
> conventions, and file structure may all differ from your training data. Read the
> relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed
> deprecation notices.

Those docs are vendored into `node_modules` and are the authority. Your training
data is not.

---

## 1. First-time setup

### Prerequisites

| Requirement | Verified on this machine | How to check |
|---|---|---|
| Node | v22.22.3 (README minimum is 20) | `node --version` |
| npm | 12.0.2 | `npm --version` |
| Docker | 29.1.3 | `docker --version` |

> **Docker needs `sudo` here, and `sudo` prompts for a password.** Without it,
> `docker ps` returns `permission denied while trying to connect to the docker
> API at unix:///var/run/docker.sock`; with it, a non-interactive shell gets
> `sudo: a terminal is required to read the password`.
>
> **An agent cannot run these unattended.** Ask the user to run them — in Claude
> Code they can prefix a command with `!` to run it in the session so its output
> lands in the conversation. Affected: `db:up`, `db:down`, and the whole of §5.
> If the user is in the `docker` group on your machine, drop the `sudo`.

### The sequence

Run from `web/`. Each step states how to tell it worked.

```bash
# 1 — dependencies. `postinstall` runs `prisma generate` for you.
npm install
#    ✓ ends with "added N packages" and no error from the postinstall step

# 2 — environment
cp .env.example .env
#    then edit .env — see the table below. DATABASE_URL already points at 5433.

# 3 — database container
sudo npm run db:up
#    ✓ prints a container id
#    ✗ "Conflict. The container name /manager-db is already in use" means it
#      already exists: `sudo npm run db:down` first, or just continue — it's running.

# 4 — schema
npm run db:migrate
#    ✓ "Your database is now in sync with your schema."

# 5 — baseline data (org tree, 6 people, 4 users)
npm run db:seed

# 6 — run
npm run dev
#    ✓ "✓ Ready in <N>ms" and "- Local: http://localhost:4321"
```

### `.env`

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | `postgresql://manager:manager@localhost:5433/manager?schema=public` — the value `db:up` serves |
| `APP_SECRET` | yes | Session signing **and** at-rest encryption. `openssl rand -hex 32`. Changing it invalidates every session and every encrypted value |
| `UPLOADS_DIR` | no | Defaults to `./uploads` in dev. In a container it **must** be a mounted volume — see §5 |
| `DEV_USER_SWITCH` | no | `"1"` enables the header user-switcher (impersonation). Local only. Never set it anywhere real |
| `ENABLE_DATA_WIPE` | no | `"1"` reveals the admin's irreversible category-delete panel. Rehearsal environments only |

### Signing in

Seeded users, all with password `password`: `admin`, `research.head`,
`alpha.lead`, `viewer`. Login accepts username **or** email.

### Optional: a realistic dataset

```bash
npm run demo:data     # additive — modifies and removes nothing
```

Everything it generates hangs off a single center, so it can be removed later
with one cascade delete from the hierarchy page. Its randomness is seeded, so two
runs produce the same people — a defect found in generated data can be found
again after a reset.

### Starting over

```bash
npm run db:reset      # drop + re-migrate + re-seed. Destroys all local data.
```

---

## 2. The four failure modes that waste the most time

These are not hypothetical. Each one has cost a debugging session in this repo.

### 2.1 After a migration: migrate → generate → **restart the dev server**

In that order, all three.

```bash
npx prisma migrate dev --name <name>
npx prisma generate          # ← do not skip, and do not reorder
# then restart `npm run dev`
```

Restarting the dev server *before* `prisma generate` leaves a stale client in
memory. The symptom is brutal: **`npx tsc --noEmit` stays completely clean while
every page returns 500**, with a runtime error like
`Value 'COMMANDERS' not found in enum 'OrgKind'`. The types are regenerated on
disk; the running process is still holding the old client. Nothing in the
compiler can see it.

### 2.2 A `"use server"` module can export **only** actions

If you put a pure helper in a file with `"use server"` at the top, the build
rejects it. Worse, a rule that lives in an actions file is reachable only inside
a request — calling it from a script throws
`cookies() was called outside a request scope`.

**So:** when a verification script needs a rule, extract the rule into a plain
module and have the action import it. Precedents in this repo: `parentRefusal`
and `commandersNameClash` pulled out of `org-actions.ts`; `isPointDone` living in
`gaps.ts`, not in `person-actions.ts`.

### 2.3 Client components must not reach `@/lib/prisma`

A module imported by a client component must not *transitively* import
`@/lib/prisma`, or Turbopack fails trying to bundle `dns`.

| Client-reachable — keep Prisma out | Server-only — Prisma is fine |
|---|---|
| `org-nesting.ts`, `plan-diagram.ts`, `gap-meta.ts`, `watch-rules.ts` | `person-view.ts`, `org.ts`, `people.ts`, `gap-dashboard.ts`, `watch.ts` |

The pattern when a rule is needed on both sides: pure rules in the client-safe
module, database reads in a sibling that imports it. `watch-rules.ts` /
`watch.ts` is the most recent example.

Note the trap this creates for *values vs types*: `import type { GapKind }` is
erased and always safe; `import { GAP_KIND_LABEL }` from a Prisma-reaching module
drags the whole graph into the client bundle. That is why the filter vocabulary
lives in `gap-meta.ts`.

### 2.4 Playwright: `networkidle` never settles

Turbopack's HMR keeps a connection open, so `waitUntil: "networkidle"` hangs
until timeout. Always:

```ts
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForSelector("h1");     // or whatever proves the page rendered
```

---

## 3. Running scripts and verification suites

There are **43** `verify-*.ts` suites in `web/scripts/`. Each asserts one
capability end to end against the dev database.

### Scripts need the environment loaded

`tsx` does not read `.env` on its own. Two equivalent ways:

```bash
# per-command
npx tsx --env-file=.env scripts/verify-gaps-under-watch.ts

# or export once into the shell, from web/
export $(grep -E '^(DATABASE_URL|APP_SECRET)' .env | tr -d '"' | xargs)
npx tsx scripts/verify-gaps-under-watch.ts
```

Without it the suite dies inside the Prisma client with a connection error that
does not mention the environment at all.

### Scripts must live under `web/scripts/`

The `@/` path alias resolves only inside the project. A throwaway script written
to `/tmp` fails with `MODULE_NOT_FOUND` on `@/lib/prisma`. Write temporary
scripts to `web/scripts/_tmp-*.ts` and delete them when done.

### Suites that drive a browser need the dev server up

`verify-*-e2e.ts`, and any suite importing `playwright`, hit
`http://localhost:4321`. Start `npm run dev` first. 27 scripts honour a
`BASE_URL` override.

### What a healthy run looks like

```
=== <section name> ===
  ✓ <statement>
  ✓ <statement> — <measured detail>

all 67 checks passed
```

Exit code 0. A failure prints `✗` on the offending line and ends with
`FAILED — N ran, M failed`, exit code 1.

### The discipline every suite follows

Hold to it when you write one:

- **Tagged fixtures the suite creates itself.** A constant like `const TAG =
  "gwverify"`, and every fixture name starts with it. A suite must never assert
  against data it did not create — several suites broke exactly that way when the
  database changed underneath them.
- **Cleanup at the start *and* in `finally`.** Starting with cleanup makes a run
  survive the previous run having crashed.
- **A `check()` counter**, so the total is visible and a silently-skipped section
  is detectable.
- **A "no fixtures left behind" check** as the last assertion.
- **Global state must be restored**, not just rows — e.g. an `AppSetting` the
  suite changed.
- **Run it twice.** A suite that passes once and fails the second time is leaking.
- **Write the failing check first and watch it fail** before you fix the code.
  A check that has never failed has not been shown to test anything.

### The standing gate before you call anything done

```bash
npx tsc --noEmit                              # must be silent
npm run build                                 # must complete
npx tsx --env-file=.env scripts/plan-diagram-golden.ts   # must say "identical"
```

The golden guards the status-less career-vector SVG. It is byte-exact
(`identical — 11675 bytes`) and it has caught real regressions that no type or
test caught — including a change that added one blank line per drawn card. If you
have genuinely and intentionally changed that drawing, re-record with
`--write`; otherwise a drift means you broke the plan page or the PDF.

---

## 4. Database facts worth knowing before you touch data

- The dev database holds **test data only** (as of 2026-07-31). Destructive
  experiments are acceptable — but *check* before assuming, rather than
  discovering it was real.
- `prisma migrate dev` writes a migration directory under `prisma/migrations/`.
  **Read the generated `migration.sql` before moving on.** A migration that
  should be purely additive and contains an `UPDATE` is a backfill you did not
  intend.
- There is no `psql` on this machine. To query the database, write a short script
  under `web/scripts/` using the Prisma client. Note that `tsx` compiles to CJS
  here, so **top-level `await` fails** — wrap it in `async function main()` and
  call it.

---

## 5. Building the air-gap image

### What "air-gap" means for this repo

The delivered image makes **zero network fetches at runtime**. Everything —
Node 22, the built app, `node_modules`, the Prisma CLI and generated client,
Chromium plus Hebrew fonts for PDF export, `pdftotext`/`tesseract` for document
extraction, `python3`, and the Claude CLI — is resolved at *build* time and baked
in.

**The consequence for you as an agent: any dependency you add must be installable
at build time and must not require network access at runtime.** A library that
lazily downloads a binary, a font, or a model on first use will pass every test
on a connected machine and fail in the target network. Check before adding.

### Build requirements

The build host **must have internet** — this is the step that reaches out, so
that the runtime never has to. It pulls `ubuntu:24.04`, the NodeSource
repository, apt packages, npm packages, `next/font` files, the Playwright
Chromium download, and `@anthropic-ai/claude-code`.

It also needs the Docker daemon (so `sudo`, so a human — see §1) and real disk
space. Measured on the last build in this repo: **`dist/` came to 1.6 GB across
17 parts**, and `docker save | gzip | split` needs room for the uncompressed
image on top of that while it streams. Several GB free, not a few hundred MB.

### The command

From the **repository root**:

```bash
sudo deploy/build-dist.sh
```

Three stages, each announced:

```
=== [1/3] building image ===           docker build -t manager-app:latest web/
=== [2/3] saving + compressing + splitting (100MB parts) ===
=== [3/3] writing loader, env template and guide ===
=== dist ready ===
```

It **deletes and recreates `dist/`** on every run.

### What lands in `dist/`

| File | Purpose |
|---|---|
| `manager-app.tar.gz.part-*` | the image, `docker save` → `gzip` → `split -b 100m` |
| `load-image.sh` | joins the parts and loads them (`cat … \| docker load`) |
| `app.env.example` | runtime environment template |
| `docker-compose.example.yml` | run example — external managed database, app only |
| `reset-db.sh` | destroys the whole database. Manual, guarded, never automatic |
| `README.md` | Hebrew install guide for the receiving site |

Carry the whole `dist/` directory into the closed network.

### The two-stage Dockerfile, in one paragraph

`web/Dockerfile` builds on `ubuntu:24.04`. The **builder** stage installs Node 22,
runs `npm ci`, then `prisma generate && npm run build && npm prune --omit=dev`.
The **runner** stage installs only runtime packages — `fonts-noto` (Hebrew in
PDF), `poppler-utils` (`pdftotext`), `tesseract-ocr` with `heb`+`eng` (OCR
fallback), `python3` (runs `docker/emailer.py`; without it mail dies with
`ENOENT` only when a user clicks send) — copies the build artefacts across,
installs Chromium into an app-owned path, and bakes in the Claude CLI. Every
writable path is group-0 writable so the image runs under **OpenShift restricted
SCC with an arbitrary UID**.

### What happens on every container start

`docker/entrypoint.sh`, and it is the same path for a first install and for a
version upgrade:

```
wait for DATABASE_URL  →  prisma migrate deploy  →  bootstrap admin  →  serve
```

- `prisma migrate deploy` gives an empty database the full schema, and an older
  database only the migrations it is missing.
- **Bootstrap admin runs only when the user table is empty**, from
  `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_EMAIL`.
- Any failure exits loudly. The app is never served half-migrated.

Upgrading is therefore: load the new image, keep the same `app.env` and the same
volume, restart.

### Runtime requirements at the destination

- **`UPLOADS_DIR` must be a mounted persistent volume (PVC).** The image defaults
  to `/app/uploads`. Anything written to the pod's own filesystem is lost when the
  pod is replaced — this is exactly why uploaded photos "disappear" after a crash.
- **Keep `APP_SECRET` stable across upgrades.** Rotating it invalidates every
  session and every encrypted value.
- **Single instance only** — there is an in-process scheduler and background jobs.
- `GET /healthz` returns 200 when app and database are both healthy, without a
  session — verified against the dev server. Wire it to liveness/readiness probes.
- Serving behind a route or reverse proxy? Set `ALLOWED_ORIGINS` to its
  hostnames, or the Server-Action origin check rejects requests.
- Email is a **stub** (`docker/emailer.py` prints, never sends). The destination
  is expected to replace it. The entire contract:
  ```
  python3 docker/emailer.py --title "<subject>" --body "<markdown>" --to "<address>"
  ```
  It prints `1` (sent) or `0` (failed) as the **last non-empty line of stdout**.
  Anything may be printed before it. **The exit code is not the verdict.**

### Verifying a build without a second machine

```bash
sudo docker images manager-app                  # the image exists
ls -lh dist/                                    # parts + loader + guide
cat dist/manager-app.tar.gz.part-* | sudo docker load    # the parts rejoin
```

---

## 6. How work is done in this repo

Changes go through **OpenSpec**, not straight to code:

```
/opsx:explore   think, measure, diagram — never implement
/opsx:propose   proposal.md + design.md + tasks.md under openspec/changes/<name>/
/opsx:apply     implement the tasks, marking each as it completes
                then: sync + archive + commit   (push only when asked)
```

Useful commands (run from the repository root):

```bash
openspec list                         # active changes
openspec status --change <name> --json
openspec validate --specs             # every main spec; currently 22/22
openspec validate <name>              # one change
```

Conventions that are easy to get wrong:

- A **MODIFIED** delta block must carry the *whole* requirement, including every
  existing scenario — not just the part being changed.
- A delta for an existing capability **ignores `## Purpose`**. To change a
  capability's purpose, edit the main spec directly.
- Archive to `openspec/changes/archive/YYYY-MM-DD-<name>/` after syncing the
  deltas into `openspec/specs/`.
- `skip_specs: true` in a change's `.openspec.yaml` for a change with no deltas.

### Repository hygiene

- `ideas` and the `דוגמה-*.xlsx` files at the root are **deliberately never
  committed**. Leave them unstaged.
- Commit messages end with:
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  Claude-Session: <session url>
  ```
- **Push only when explicitly asked.** It is requested separately each time.

---

## 7. Quick reference

| Command | From | What it does |
|---|---|---|
| `npm run dev` | `web/` | dev server on :4321 |
| `npm run build` | `web/` | production build — part of the done-gate |
| `npx tsc --noEmit` | `web/` | typecheck — part of the done-gate |
| `sudo npm run db:up` / `db:down` | `web/` | start / remove the Postgres container |
| `npm run db:migrate` | `web/` | `prisma migrate dev` (then `generate`, then restart) |
| `npm run db:seed` | `web/` | re-seed the baseline fixture |
| `npm run db:reset` | `web/` | drop + re-migrate + re-seed |
| `npm run demo:data` | `web/` | add a representative organisation (additive, seeded) |
| `npx tsx --env-file=.env scripts/verify-*.ts` | `web/` | a verification suite |
| `npx tsx --env-file=.env scripts/plan-diagram-golden.ts` | `web/` | the SVG golden (`--write` to re-record) |
| `sudo deploy/build-dist.sh` | repo root | build the air-gap delivery package into `dist/` |
