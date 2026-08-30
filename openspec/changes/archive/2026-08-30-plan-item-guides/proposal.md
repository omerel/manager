# Proposal: plan-item-guides

## Why

A plan says WHEN something is due; it cannot say what it should look like. The submission form, the evaluation template, the guidance sheet — those live in a mailbox or a shared drive, and the commander filling an event has to go find them. The same is true of an interview summary: there is a house format, and nothing in the system hands it to the person writing one.

## What Changes

- A **point event** and a **recurring event** in a career plan may carry one file under «פורמטים והנחיות» — a format to fill in, or a page of guidance. Uploaded by the Admin in the plan editor, where the item is authored. Cumulative metrics do not take one, per the request.
- On a person's card the file is offered for download **at the event itself**; for a recurring event it appears at every occurrence, since every occurrence needs the same form.
- The file is read **live from the template**, not snapshotted into each person's copy: a guideline is the document that applies NOW, and an assigned person holding last year's form would be a fault rather than history. This requires copies to point back at the template item they came from — a pointer the schema does not have today.
- **Interview summaries** get the same idea at the level they belong to: a single house format, uploaded by the Admin under system settings (the `AppSetting` pattern the logo and the login link already use), offered for download beside the interview form on every person's card.
- Deleting a plan item removes its file. Replacing a file removes the one it replaced.
- Existing plan copies keep no pointer and therefore show no guideline — decided deliberately over backfilling.

## Capabilities

### Modified

- `career-plans`: gains the guideline-file requirement (authoring, the live rule, deletion).
- `evaluations-and-events`: gains the interview format requirement.

## Impact

- `prisma/schema.prisma` + migration: guideline columns on `PointEvent` and `RecurringEvent`, plus `sourceEventId` on each so a copy can find its template item.
- `web/src/lib/plan-actions.ts` — upload/remove alongside the existing item actions.
- `web/src/lib/person-actions.ts` — `assignPlan` records the source pointer while copying.
- `web/src/lib/person-view.ts` — the guideline travels on the timeline rows.
- `web/src/app/plans/[id]/page.tsx`, `web/src/app/people/[id]/page.tsx`, `web/src/components/EvaluationsSection.tsx` — the upload control and the download links.
- `web/src/lib/branding.ts` + `branding-actions.ts` + `web/src/app/system/page.tsx` — the interview format setting.
- New: a route serving a guideline file to any signed-in user.
