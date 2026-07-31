## Why

A recurring event can currently stop either at a fixed month offset or "at end of service". The second option rests on a fact the organisation does not actually know: most people have no end-of-service date on file — in the current data, six of eight. When it is missing, the code silently falls back to a 36-month horizon that was introduced as a **preview default for the plan page** and quietly became the rule the gap engine computes against. Those people stop being asked for occurrences after two and a half years, and the system then reports 🟢 "all occurrences filed" indefinitely. Nobody chose 36 as policy.

The option also makes a plan template non-deterministic: two people on the same plan get different schedules depending on whether a departure date happens to be recorded. Every other element of a plan — point events, metric checkpoints — is defined purely as an offset from recruitment.

Separately, clipping at departure is right, but it is a fact about a person, not an authoring choice. Today it is wired to the mode being removed, so an event that stops at a fixed month keeps accruing overdue occurrences for someone who left long before.

## What Changes

- **BREAKING (authoring):** a recurring event's stop condition is always a month offset from recruitment. "Until end of service" is removed from the plan editor, and the month field becomes required.
- Existing recurring events that used end-of-service are migrated to stop at **72 months**.
- The `RecurringStopMode` column is **kept in the schema** as a deliberate safety margin, but no row will hold `END_OF_SERVICE` and nothing will write it.
- **Departure clipping becomes universal**: for a person with an end-of-service date, occurrences are clipped at that date for *every* recurring event, not only ones formerly in end-of-service mode. A person who left stops accruing overdue occurrences.
- **No silent horizon.** The occurrence cap always comes from the plan. A missing cap is surfaced, never replaced by a default.
- The career-path diagram switches to an **event-ordinal axis**: recruitment at the base, then a tick for each month in which something happens, evenly spaced, each labelled with its month number, with a visible break marker where the axis skips. This keeps the diagram readable at a 72-month range instead of growing to roughly twice its current height.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `career-plans`: recurring events stop at a required month offset; the career-path diagram uses an event-ordinal axis rather than a proportional calendar axis.
- `gap-engine`: occurrences derive only from the plan's explicit cap, additionally clipped by a person's end-of-service date when one is known; no implicit horizon.

## Impact

- `prisma/schema.prisma` — `stopOffsetMonths` becomes required in practice (enum retained, unused value)
- Data migration — end-of-service events become 72-month events
- `src/lib/plans.ts` (`unrollRecurring`), `src/lib/person-view.ts` (`unrollForPerson`), `src/lib/gaps.ts` — cap and clipping logic
- `src/app/plans/[id]/page.tsx` — the stop-condition field in both the add and edit forms
- `src/lib/plan-actions.ts`, `src/lib/person-actions.ts` — writing and copying recurring events
- `src/lib/plan-diagram.ts` — the axis, tick placement, height calculation and PDF export
- Old backup bundles containing `END_OF_SERVICE` rows are out of scope: they are not relevant in this deployment
