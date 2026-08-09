## 1. The record
- [x] 1.1 `PersonMovement` + `MovementKind` (CREATED/MOVED/REMOVED/DEPARTED), snapshot fields, no FKs, indexed by time; migration read then applied
- [x] 1.2 `src/lib/movements.ts`: `emitMovement` (resolves the actor itself, swallows its own failures — a log must not fail the act), `readMovements` scope-filtered from-OR-to, sampled pruning via `MOVEMENT_LOG_DAYS`

## 2. Emission at every channel
- [x] 2.1 Manual/intake creation, team reassignment, person deletion — beside the existing logActivity calls
- [x] 2.2 Status transitions in updatePerson: emit DEPARTED only on a transition INTO עזב, comparing against the stored status
- [x] 2.3 Bulk import: one CREATED per person actually created, source ייבוא
- [x] 2.4 Framework deletion: capture the subtree's people BEFORE the delete, emit MOVED→ללא שיוך for each, source מחיקת מסגרת — the silent orphaning gets witnesses
- [x] 2.5 Backup restore stays silent, with the reason commented

## 3. The screen
- [x] 3.1 Part three of /hr: a daily cut with date navigation, filters for kind, framework and actor, each row linking to the person where they still exist
- [x] 3.2 Scope: HR sees from-or-to within their edit scope; the Admin everything

## 4. Verification
- [x] 4.1 Engine suite: every channel emits with the right kind/from/to, the orphaning emission, DEPARTED only on transition, scope from-or-to (a move OUT of scope stays visible), deleted-person rows readable, pruning honours the env
- [x] 4.2 E2E: movements appear on the page with working filters and links; a deleted person shows unlinked; a Manager cannot reach it
- [x] 4.3 Suites twice, tsc, build; existing suites green
