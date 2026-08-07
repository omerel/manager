# ניהול קריירה — web

Walking skeleton of the career-management system (see `../openspec/changes/career-management-system/`).
Stack: Next.js 16 (App Router) + TypeScript + Prisma 7 + PostgreSQL. UI is Hebrew / RTL.

## Prerequisites

- Node 20+
- A PostgreSQL instance. Locally we run one in Docker on port **5433**.
  `DATABASE_URL` is configured in `.env`.

## First-time setup

```bash
# 1. Start Postgres (Docker daemon requires sudo on this machine)
sudo npm run db:up            # docker run postgres:16 -> localhost:5433

# 2. Apply the schema
npm run db:migrate            # prisma migrate dev

# 3. Seed demo data (org tree, 6 people, 4 users with grants)
npx tsx prisma/seed.ts        # or: npm run db:seed

# 4. Run the app
npm run dev                   # http://localhost:4321

# 5. Sign in
# Seeded users (all with password "password"): admin, research.head, alpha.lead, viewer
# Change these before any real deployment (admin can reset passwords on /access).
```

## Authentication

Login (`/login`) accepts username **or** email + password (scrypt-hashed at rest).
Sessions are HMAC-signed HTTP-only cookies (7 days, signed with `APP_SECRET`);
every page and data route requires a valid session. Users change their own
password on `/account`; the admin resets any password on `/access`.

For local role-testing, set `DEV_USER_SWITCH="1"` in `.env` to enable the header
user-switcher (impersonation). Leave it unset in any real deployment.

## What the app shows

- **Career plans as the contract** — a plan is a template of offsets from a person's
  **unit placement date**: point events, cumulative metrics with checkpoints, and
  recurring events that unroll from a start offset. Offsets are written
  `years.months` (`3.4` = 3 years 4 months) and resolve through the placement
  date alone (`src/lib/plans.ts`, `years-months.ts`).
- **Assignment carries history** — assigning a plan copies it per person and *ends*
  the previous assignment rather than deleting it, so milestones, readings and
  filed evaluations survive a transfer. Items predating the assignment are
  waived and marked, never counted (`plan-assignment.ts`, `waivers.ts`).
- **The gap engine** — every plan item resolves to a date and a state:
  🟢 met · ⬜ future · 🟡 approaching · 🔴 overdue. Rolled up the org tree and
  filterable by framework and gap kind (`gaps.ts`, `gap-dashboard.ts`).
- **People** — a scoped list with a career-plan column and a filter on every
  column, plus a person card holding details, plan, progress and evaluations.
- **Evaluations & interviews** — recurring occurrences are slots awaiting content;
  interviews carry a five-point assessment and the date they happened. Documents
  attach to the record (`eval-actions.ts`, `eval-scale.ts`).
- **Commander queries** — a commander asks a chosen set of commanded frameworks a
  question with a deadline, answers gather in one place, and only the two
  frameworks involved can read it (`queries.ts`).
- **The agent** — free-form questions over a permission-clipped snapshot,
  read-only (`Read,Grep,Glob`, no shell). A good answer can be pinned as a
  deterministic rule that reruns instantly, and reports export to MD/PDF or go
  out by email (`agent.ts`, `rules-engine.ts`, `emailer.ts`).
- **Bulk intake** — drop many personnel documents at once; each is extracted
  server-side (pdftotext / mammoth / SheetJS, OCR fallback) and queued for
  field-by-field approval. Nothing is written without a human accepting it.
- **Access control** — a user's visibility is the union of their granted org-tree
  subtrees (`access.ts`); command of a framework is separate from visibility of it
  (`commander.ts`). The dashboard, rollups, people list and agent all re-clip per
  signed-in user.
- **Activity log** — `/system/activity`: who changed what and when, for the Admin
  to investigate with.

## Handy scripts

| script                | what it does                                      |
|-----------------------|---------------------------------------------------|
| `npm run dev`         | dev server on :4321                               |
| `npm run db:up`       | start the Postgres container (needs sudo)         |
| `npm run db:down`     | remove the Postgres container                     |
| `npm run db:reset`    | drop + re-migrate + re-seed                       |
| `npm run db:seed`     | re-seed the baseline fixture                      |
| `npm run demo:data`   | add a representative organisation (additive)      |
| `npx tsx scripts/verify-*.ts` | the verification suites — each asserts one capability end to end |

## Deployment (air-gapped, Docker / OpenShift)

The app ships as a self-contained Ubuntu 24.04 image — Node, the built app,
Prisma CLI, Chromium + Hebrew fonts (PDF), and the Claude CLI are all baked in.
**Zero network fetches at runtime.**

```bash
# On a connected machine — builds the full delivery package into ./dist:
sudo deploy/build-dist.sh
# dist/ contains the image gzipped + split into 100MB parts, a loader script,
# an env template and a Hebrew install guide. Carry dist/ into the air-gapped
# network and follow dist/README.md (load-image.sh → app.env → run).
```

The app listens on **0.0.0.0** — reachable from remote machines on the mapped port.

**Every container start runs the same self-init sequence:** wait for
`DATABASE_URL` → `prisma migrate deploy` (empty DB → full schema; older DB →
only new migrations) → **bootstrap admin** (only when the user table is empty,
from `ADMIN_USERNAME`/`ADMIN_PASSWORD`/`ADMIN_EMAIL`) → serve. First boot and
version upgrades are the same path; failures exit loudly.

**First-run checklist:** log in as the bootstrap admin → change its password →
(optional) הגדרות מערכת → import a configuration bundle or a full backup to
populate the system.

**Operational notes:**
- `/healthz` (public) returns 200 when app+DB are healthy — wire it to
  liveness/readiness probes.
- **Uploads must live on a mounted persistent volume (PVC), not on the pod's own
  filesystem** — otherwise photos and attached documents vanish when the pod is
  replaced or crashes. The image defaults to `UPLOADS_DIR=/app/uploads`; mount a
  PVC there, or mount it elsewhere and set `UPLOADS_DIR` to the mount path.
- Keep `APP_SECRET` stable across upgrades.
- Single instance only (in-process scheduler + background jobs).
- OpenShift restricted SCC (arbitrary UID) is supported — all writable paths
  are group-0 writable, including the CLI home.
- The Claude CLI is baked in and agent runs inherit the container env — if your
  CLI setup needs anything, provide it to the pod as you do elsewhere; to use
  your org's own CLI build, bind-mount it over `/usr/bin/claude`.
- Serving through a route/proxy? set `ALLOWED_ORIGINS` to its hostname(s).

