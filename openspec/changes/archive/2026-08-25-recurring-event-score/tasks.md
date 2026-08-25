# Tasks: recurring-event-score

- [x] 1. Schema: `RecurringEvent.withScore Boolean @default(false)` + migration `recurring_with_score`; `prisma generate`.
- [x] 2. Plan editor: checkbox «מילוי עם דירוג» in add + edit recurring forms (`plans/[id]/page.tsx`), parsed in `addRecurringEvent`/`updateRecurringEvent`; summary line names it.
- [x] 3. `assignPlan` copies `withScore`; `person-view.ts` `RecurrenceRow.withScore`; `fillSlot` parses the optional score for flagged events (create + update).
- [x] 4. `EvaluationsSection`: rating select on flagged slots' fill form; scoreLabel pill on the filled slot.
- [x] 5. Verify: `npx tsc --noEmit`; new `web/scripts/verify-recurring-score.ts` passing twice; `verify-recurring-display` + `verify-card-approaching` green; `npm run build` clean.
