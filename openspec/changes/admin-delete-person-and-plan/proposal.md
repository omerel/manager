## Why

Records can be created but never removed. A person entered by mistake, a duplicate, or a career-plan template that was abandoned stays in the system forever — inflating the people list, polluting the gap dashboard, and offering a dead track in the assignment dropdown. The only existing escape hatch is `reset-db.sh`, which destroys everything.

Deleting is also the one operation the data model does *not* fully handle on its own. Measured against the development database in a rolled-back transaction: a naive `person.delete` leaves the person's own plan copies behind — 2 orphan `CareerPlan` rows and 14 orphan plan items for a single person — because a copy has no foreign key back to the person it was made for. The person's uploaded files stay on disk too. So "delete" needs a defined meaning, not a button wired to the ORM.

## What Changes

- **The admin can delete a person** from the people list. Deletion is total: the person, their whole history (plan assignments, waivers, carry-overs, milestones, readings, evaluations and their attachments, custom field values, agent runs, extraction proposals), **their per-person plan copies**, and their uploads directory on disk.
- **The admin can delete a career-plan template** from the plans list. The template and its own items are removed; people already assigned a copy of it keep their copy, their progress and their gap status unchanged. Only the link from the people list to the template dies, and the list already renders that case.
- **Both deletions are confirmed by a modal that states the real counts** read from the database — the same pattern already used for deleting a framework in the hierarchy page — and neither is reachable by a non-admin. The modal lists only what is not zero, and says plainly when a person has no history at all, which is true of 4 people in 10 today.
- Deleting a template is **allowed while people are assigned to it**, with the number of affected people shown in the warning. It is not blocked: the schema was built for it (`PlanAssignment.templateName` is a snapshot kept so history survives the template's deletion).
- **No new deletion path for plan copies**: a copy is deleted only as part of deleting its person. Ending an assignment remains the way a person leaves a plan.
- **The card-schema page stops misdescribing the fixed core fields.** Its description and its banner both list them, they list different sets, and both are stale: they say "שם" for what is now first name and last name, and omit date of birth (required), the profile photo and the career plan. Both are corrected and derived from one exported list, so the page can no longer state two different answers to the same question.

## Capabilities

### New Capabilities

None. Both changes extend capabilities that already exist.

### Modified Capabilities

- `people-registry`: a person can be deleted, with a defined and complete meaning for what "deleted" removes — including the plan copies and files that no cascade reaches.
- `career-plans`: a plan template can be deleted, and what happens to the people holding a copy of it is stated rather than left to the foreign keys.

## Impact

- **New server actions**: `removePerson` in `src/lib/person-actions.ts`, `removePlan` in `src/lib/plan-actions.ts`. Both `requireAdmin()`.
- **Read helpers** for the confirmation counts, computed with the list rather than on demand: `getVisiblePeople` gains per-person counts (one query — measured at 7.6 ms for 40 people against 1.1 ms without), and the plans list gains an unclipped count of who holds each template.
- **UI**: `src/components/PeopleTable.tsx` gains an admin-only actions column and a confirmation modal; `src/app/plans/page.tsx` gains a delete control per row, which makes the row a client component.
- **Core-field text**: a `CORE_FIELDS` list exported from `src/lib/person-schema.ts`, consumed by both places in `src/app/people/card-schema/page.tsx` that currently spell it out by hand.
- **Storage**: `src/lib/storage.ts` gains a directory-level delete for `uploads/<personId>`, guarded by the existing uploads-root check.
- **No schema migration.** The existing cascades do most of the work; the gap is closed in the action, not in the FKs.
- **Not touched**: the person detail page and the plan detail page keep their current controls. The request was for the two list pages.
