# Proposal: recurring-event-score

## Why

Interview summaries carry an optional 1–5 rating (`EvalEntry.score`, the EVAL_SCALE); recurring-event fills — the periodic feedbacks that are the plan's backbone — cannot. A plan author who wants a rated «חוו״ד חצי-שנתית» has no way to say so, and the fill form has nowhere to put the number. The user asked for the interview-style rating as a per-event option at template authoring time.

## What Changes

- `RecurringEvent.withScore Boolean @default(false)` — the first schema migration in a while.
- The plan editor's recurring-event forms (create and edit) gain a «מילוי עם דירוג» checkbox; the event's summary line names it.
- Assignment copies the flag onto the person's plan copy.
- Filling a slot of a flagged event offers the same optional rating select the interview form has («ללא דירוג» is an explicit choice); the score lands on the same `EvalEntry.score` column, refused outside 1–5 exactly as interviews refuse it.
- A filled slot with a score shows the same scoreLabel pill interviews show.
- Unflagged events are untouched: no select, no score stored.

## Capabilities

### Modified

- `evaluations-and-events`: gains the rated-recurring-fill requirement (option at authoring, optional value at fill, displayed like an interview's).

## Impact

- `prisma/schema.prisma` + migration.
- `web/src/lib/plan-actions.ts` (add/update recurring), `web/src/app/plans/[id]/page.tsx` (forms).
- `web/src/lib/person-actions.ts` (assignPlan copy).
- `web/src/lib/eval-actions.ts` (fillSlot), `web/src/lib/person-view.ts` (`RecurrenceRow.withScore`), `web/src/components/EvaluationsSection.tsx` (select + pill).
