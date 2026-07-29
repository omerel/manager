## Context

Single-instance app, one Postgres, uploads on local disk, admin-only configuration surface already exists (/system). No backup/restore or environment-migration path. Prisma models are the full inventory of business data; ids are cuids referenced across ~15 tables.

## Goals / Non-Goals

**Goals:**
- One-file full backup (data + files) and one-click guarded restore.
- Config-only export for review/seeding.
- Atomic DB restore; original ids preserved so every relation survives.

**Non-Goals:**
- Merge/diff imports, partial restores, scheduled automatic backups, cross-version migration of old bundles (v1 imports v1), streaming very large archives.

## Decisions

**D1 — Bundle = ZIP with `data.json` + `files/` (adm-zip).**
`data.json`: `{ version: 1, scope: "full"|"config", exportedAt, tables: {...} }`, each table dumped in dependency order. Files copied under `files/<original relative uploads path>` so restore is a straight copy-back. *Why adm-zip:* tiny sync API, no streams needed at this scale. Config export skips files → served as bare JSON for easy reading.

**D2 — Export inventory is explicit, not reflective.**
A hand-maintained list of models per scope (config: AppSetting, PersonFieldDef, OrgNode, CareerPlan templates+events, User+AccessGrant; full: + assigned plan copies, Person+field values+progress+readings, EvalEntry+Attachment, Rule). Excluded: AgentRun, PersonDraft, ExtractionProposal (transient). *Why explicit:* a schema change then forces a conscious decision about portability (and a version bump) instead of silently leaking new tables.

**D3 — Restore = wipe + insert inside one `$transaction`, original ids kept.**
Delete in reverse dependency order, `createMany` in forward order, all in a single transaction → atomicity requirement satisfied for the DB. Files restored after the DB commit (worst case: missing files, data consistent — same failure class the app already tolerates). *Why keep cuids:* rewriting ids means rewriting every FK; preserving them makes restore trivial and exact.

**D4 — The importing admin survives restore.**
Full bundles include users + password hashes, so after restore logins are the bundle's. Edge: the current admin may not exist in the bundle → after import, the session may become invalid; UI warns "לאחר שחזור ייתכן שתידרש התחברות מחדש עם משתמשי הגיבוי". No special-casing beyond the warning.

**D5 — Config import allowed only into an empty registry.**
Config bundles replace config tables; if people exist they reference teams/plans that are about to vanish → reject unless `person.count() === 0`. *Why not merge:* id collisions and semantic dedup are a project of their own (non-goal).

**D6 — Surface: "גיבוי ונתונים" section on /system.**
Two export buttons (full ZIP via a GET download route, config JSON likewise) + an import form (file + required confirmation checkbox) posting to a server action; result banner with counts (people, users, files restored). All behind `requireAdmin`.

## Risks / Trade-offs

- **Bundles contain password hashes and personal data** → scrypt hashes are hard to reverse, but the UI states plainly: store backups securely. (Encrypted bundles = future option.)
- **Wipe-and-restore is destructive** → confirmation checkbox + atomic transaction + the error path restores nothing partially.
- **Large uploads dir could make big ZIPs in memory (adm-zip)** → acceptable at current scale; noted as the trigger to move to streaming later.
- **Version drift** → bundles are stamped `version: 1`; importer hard-rejects other versions.

## Migration Plan

No DB migration. Ship export first (read-only, zero risk), then import. Verify on a copy: export → wipe → import → diff counts.

## Open Questions

- Encrypted bundles (password-protected ZIP) — worth it for v2?
- Should rules (private per user) be excludable from export? v1 includes them (a backup is a backup); revisit if sharing bundles becomes a habit.
