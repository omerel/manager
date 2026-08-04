## Why

When something in the registry looks wrong, there is no way to find out who changed it or when. A person's date is different from what someone remembers, a plan item is missing, a grant appeared — and the system holds no trace of the act, only its result. The Admin has no way to investigate anything.

## What Changes

- **A new Admin-only page shows what users did**: who, what, when, and to which record. Ordered newest first, filterable by user and by kind of action, so an investigation starts from either end.
- **Meaningful actions record one readable line each** (the user's decision), written where the action happens: "אומר מחק את דנה כהן", not a list of affected tables. The log is for a person reading it, not for replaying state.
- **Log entries expire.** Retention is a month by default and set by an environment variable (the user's decision), so the table does not grow without bound in a system that runs for years.
- The log records **that** something happened and to what — not the before and after values. It is a trail for investigation, not an audit of content or a way to undo.

## Capabilities

### New Capabilities

- `activity-log`: what is recorded, who may read it, and how long it is kept.

### Modified Capabilities

None. The log observes existing behaviour without changing any of it.

## Impact

- `prisma/schema.prisma` — an `ActivityLog` model (actor, action kind, a rendered description, optional subject type + id, timestamp) and its migration. Deliberately denormalised: the description is written at the moment of the act, so a later rename or deletion cannot rewrite history or leave a dangling reference.
- **New** `src/lib/activity-log.ts` — one `logActivity()` used by every recorded action, and the reader the page uses.
- **Recorded actions** across `person-actions.ts`, `plan-actions.ts`, `org-actions.ts`, `access-actions.ts`, `eval-actions.ts`, `rules-actions.ts`, `portability-actions.ts`, `branding-actions.ts`, `auth-actions.ts`, `intake-actions.ts` — the create/update/delete and access-granting ones, not every one of the 64 server actions.
- **New** `src/app/system/activity/page.tsx` (or a section of system settings) — admin-only, redirecting anyone else, with the filters.
- Retention enforced on write, so no scheduler is introduced for it.
- **Not changed**: existing behaviour of any recorded action. A logging failure must never fail the action it observes.
