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
npm run dev                   # http://localhost:3000 (or next free port)
```

## What the skeleton shows

- **Access control** — a user's visibility is the union of their granted org-tree
  subtrees (`src/lib/access.ts`). Switch the **משתמש פעיל** in the header to see the
  dashboard, headcount rollup, and people list re-clip per user. Real auth is deferred;
  the active user is a cookie stand-in.
- **Org tree + rollup** — `center ▸ domain ▸ section ▸ team ▸ person`, with a headcount
  rolled up the tree (`src/lib/org.ts`).
- **People** — a scoped list and a person card. Opening a person outside your scope 404s.
- **Users & grants** — `/access` shows the role + grant model.

## Handy scripts

| script            | what it does                                  |
|-------------------|-----------------------------------------------|
| `npm run db:up`   | start the Postgres container (needs sudo)     |
| `npm run db:down` | remove the Postgres container                 |
| `npm run db:reset`| drop + re-migrate + re-seed                   |
| `npm run db:seed` | re-seed demo data                             |
| `npm run dev`     | dev server                                    |

## Not yet built (next phases)

Career plans (point / cumulative / recurring events), progress recording, evaluations &
files, the gap engine, PDF ingestion, and the read-only agent (rules + chat). See
`tasks.md` in the change folder for the full sequence.
