## 1. Model and writer

- [x] 1.1 `ActivityLog` in `schema.prisma`: `actorId`, `actorName`, `action`, `description`, `subjectType?`, `subjectId?`, `createdAt`, indexed on `createdAt` and on `actorId`. Comments state why `actorName`/`description` are snapshots and why `subjectId` carries **no** foreign key — the interesting entries point at rows that no longer exist. Additive migration, no backfill.
- [x] 1.2 `src/lib/activity-log.ts` — `logActivity({ action, description, subjectType?, subjectId? })`, resolving the actor itself from the session so no caller can attribute an act to someone else. **Swallows its own errors**: a trail that cannot be written must not fail the edit it observes.
- [x] 1.3 Retention in the same module: delete entries older than `ACTIVITY_LOG_DAYS` (default 30, `0` = keep everything), run opportunistically on a sampled fraction of writes rather than on every insert, so no range delete sits in the path of every edit and no scheduler is introduced.
- [x] 1.4 `readActivity({ actor?, action?, take })` for the page — calls `requireAdmin()` itself, because the page is presentation and the data function is what is actually reachable.

## 2. The recorded actions

- [x] 2.1 People: `createPerson`, `updatePerson`, `removePerson`, `reassignTeam`, `assignPlan`, `unassignPlan`, `setPointDone`, `setMetricReading`.
- [x] 2.2 Plans: `createPlan`, `renamePlan`, `copyPlan`, `removePlan`, `addPointEvent` / `addCumulativeMetric` / `addCheckpoint` / `addRecurringEvent`, the three `update*` and `deletePlanItem`.
- [x] 2.3 Org and access: `addOrgNode`, `updateOrgNode`, `removeOrgNode`, `createUser`, `deleteUser`, `addGrant`, `removeGrant`, `adminResetPassword`.
- [x] 2.4 Content and config: `addFreeEntry`, `fillSlot`, `deleteEntry`, `addFieldDef` / `updateFieldDef` / `removeFieldDef`, `importBundle`, branding changes, `startIntake`.
- [x] 2.5 Each call writes **one** sentence naming the subject as a person would ("מחק את דנה כהן"), placed after the action's own work so a failed action leaves no entry.
- [x] 2.6 Deliberately not recorded: reads, `login`/`logout`, chat questions and rule runs (already in `AgentRun`), and per-field proposal resolutions. Note this in the module's doc comment so the omissions read as decisions, not gaps.

## 3. The page

- [x] 3.1 `src/app/system/activity/page.tsx` — admin-only, redirect otherwise; newest first, bounded page size; each row shows the time, the actor and the description.
- [x] 3.2 Filters by actor and by action kind, offering only values present in the log so a filter can never return nothing.
- [x] 3.3 Link it from system settings, admin-only.

## 4. Verification

- [x] 4.1 One action per family writes exactly one entry, with the right actor and a description naming the subject — people, plans, org, access, content.
- [x] 4.2 The entry survives its subject: delete a person, then assert their entry still names them.
- [x] 4.3 Renaming a user does not rewrite their older entries.
- [x] 4.4 A failing action writes no entry; a failing `logActivity` does not fail the action (force it and assert the edit still committed).
- [x] 4.5 Authorization: a non-admin gets nothing from `readActivity`, and `/system/activity` redirects them — checked by replaying a real request under a manager session, not only by the page not rendering a link.
- [x] 4.6 Retention: with `ACTIVITY_LOG_DAYS=1`, an entry dated two days ago is removed once writes continue; with `0`, it is kept.
- [x] 4.7 Delete throwaway scripts; keep the reusable verification alongside the existing `verify-*` ones. (verify-activity-log.ts kept; the page and real-action checks ran inline against the dev server)
