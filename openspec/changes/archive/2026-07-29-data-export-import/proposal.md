## Why

All system data lives in one local Postgres with no backup/restore story and no way to move a configured system between environments (dev → real deployment, or seeding a new center from an existing configuration). The admin needs first-class export/import from the settings area: full data backups, configuration-only exports, and a guarded restore.

## What Changes

- **Full export (backup)** — the Admin downloads a single ZIP bundle: `data.json` (org tree, card schema, plan templates, people with field values / progress / evaluations, users with grants and password hashes, rules incl. pinned realizations, app settings) plus the referenced upload files (attachments, photos, logo). Transient records (agent runs, drafts, extraction proposals) are excluded.
- **Configuration-only export** — a lighter JSON of just the "schema" layer: card-field definitions, org tree, plan templates, users + grants, app settings — no people records. Useful for reviewing or bootstrapping a fresh system.
- **Import / restore** — the Admin uploads a bundle:
  - A **full bundle** performs a complete restore: wipes business tables and recreates them with original ids (relations preserved), restoring files too. Guarded by an explicit confirmation checkbox ("ימחק את כל הנתונים הקיימים") — **destructive by design**.
  - A **configuration bundle** may be imported only when the people registry is empty (fresh-system seeding); otherwise it is rejected with a clear message.
- **Versioned bundle format** — `{ version, scope, exportedAt }` header; imports validate version and scope and fail cleanly on mismatch.
- **UI** — a new "גיבוי ונתונים" section on the existing admin system-settings page (/system).

## Capabilities

### New Capabilities
- `data-portability`: Admin export (full ZIP backup / configuration JSON) and guarded import/restore with versioned bundles.

### Modified Capabilities
<!-- None: existing capabilities' requirements are unchanged; this adds a new admin capability. -->

## Impact

- **Code**: `adm-zip` dependency; export/import service (`src/lib/portability.ts`), download route(s), server actions, and a settings-page section. No schema migration (reads/writes existing tables).
- **Security**: admin-only end to end; import is destructive and double-confirmed; bundles contain password hashes — the UI warns to store backups securely.
- **Constraint**: restore replaces data wholesale (no merge) — the honest v1 of backup/restore; merge/dedup import is explicitly out of scope.
