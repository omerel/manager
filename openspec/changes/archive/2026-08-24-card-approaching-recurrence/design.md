# Design: card-approaching-recurrence

## Approach

One shared rule, rendered in one more place. The slot row in `EvaluationsSection` already derives `pastDue` inline from the due date; the approaching state joins it, derived through `dueLevel` from `@/lib/gaps` — the exact function the dashboard's count flows from — never a locally re-derived threshold.

## Decisions

1. **State precedence per slot**: filled ✅ → past-due 🔴 → waived ⊘ → approaching 🟡 (`dueLevel(dueDate, today) === "APPROACHING"`) → future ⬜. Waived wins over approaching: an occurrence nobody requires cannot be "approaching" anything — matching the engine, which filters waived occurrences before leveling.

2. **Visual language**: the row mirrors the existing tints — amber border and background (`border-amber-200 bg-amber-50/50`), 🟡 marker, suffix «· מתקרב» — the same family as the red past-due row, so the five states read as one scale.

3. **Where it computes**: in the component, from the slot's existing `dueDate` — `EvaluationsSection` already receives `today`-comparable data and derives `pastDue` there; adding a sibling derivation keeps one pattern rather than threading a precomputed level through `person-view.ts`. Importing `dueLevel` into the component is import-of-lib-from-component, already the norm (it imports gap meta today).

## Verification

`web/scripts/verify-card-approaching.ts`: fixture person with a recurring event unrolled so one occurrence lands inside the approaching window and one far future; assert `computePersonGaps` reports the person APPROACHING (the dashboard's view), and the card page HTML marks exactly the near occurrence «מתקרב» with the amber row while the far one stays plain; a waived near occurrence shows ⊘, not 🟡. Existing `verify-recurring-display` rerun.
