## Why

Plan offsets are authored and displayed in raw months. At the scale plans actually run — 72 months and beyond — "48 חודשים מהגיוס" forces mental division on every read, and a wrong entry (36 vs 30) is hard to catch by eye. The admin thinks in years.

Separately, a recurring event has no start: its first occurrence always falls one interval after recruitment. A biennial evaluation that should begin only after two years of service cannot be expressed — the plan lies about the early years.

## What Changes

- **Offsets are written as years.months**: the integer part is years, the digits after the dot are months (`3.4` = 3 years and 4 months). The rule is positional, not decimal — `3.1` is one month, `3.10` is ten — so inputs are parsed from the raw string, never from the float. Month part above 11 is rejected.
- The notation applies to **point-event offsets, metric checkpoint offsets, recurring stop, and the new recurring start** — authoring inputs and every display (plan page, occurrence previews, diagram). **The recurring interval stays in months** ("כל 6 חודשים"), per the user's decision: a natural half-year cadence reads better as 6 months than as `0.6`.
- **Storage does not change.** Offsets remain integer months in the database; this is a parse-and-format change at the edges.
- **Recurring events gain a start offset** (**BREAKING** for the `RecurringEvent` model): a required years.months value stating when the cycle begins. The first occurrence falls **at the start itself**, then every interval up to the stop. Existing events are backfilled with start = interval, which reproduces today's behavior exactly.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `career-plans`: a new requirement pins the years.months notation and its parsing rule; the recurring-event requirement gains the start offset and its unroll semantics.

## Impact

- `src/lib/plans.ts` — `parseYearsMonths` / `formatYearsMonths` helpers; `unrollRecurring` gains a start parameter; `formatOffset` rewritten around the notation.
- `web/prisma/schema.prisma` — `RecurringEvent.startOffsetMonths Int`; one migration with an in-SQL backfill (`start = interval`).
- `src/lib/plan-actions.ts` — all offset fields parsed from strings; recurring create/update take the start; validation start ≤ stop.
- `src/app/plans/[id]/page.tsx` — offset inputs become text fields with the notation; occurrence preview and summaries reformatted.
- `src/lib/plan-diagram.ts`, `src/lib/gaps.ts`, `src/lib/plan-assignment.ts` — unroll callers pass the start; displayed offsets reformatted.
- `src/lib/eval-actions.ts` — occurrence validation must accept the shifted offset grid (task to audit).
- Not touched: the recurring interval's unit, gap-engine thresholds, stored data semantics.
