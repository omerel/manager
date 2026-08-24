# Proposal: card-approaching-recurrence

## Why

The gap engine marks an unfilled recurring occurrence within the 30-day window as «מתקרב», and the dashboard counts the person 🟡 for it — but on the person card that occurrence renders as a plain future slot (⬜), indistinguishable from one due in three years. The card's own header even counts it («🟡 1 מתקרבים») while no row below is marked. Point events and metrics carry a 🟡 badge; recurring occurrences are the one item kind whose approaching state the card hides. A manager sent by the dashboard cannot find which event to act on — the reported bug.

## What Changes

- The recurrence slot list on the person card gains a fifth visual state: an unfilled, unwaived occurrence whose due date is within the approaching window renders 🟡 with an amber-tinted row and the label «מתקרב», alongside the existing ✅ / 🔴 / ⊘ / ⬜ states.
- The state is computed with the same `dueLevel` (and `APPROACHING_DAYS`) the gap engine uses — the card and the dashboard cannot disagree by construction.
- No schema change, no new packages; one component and its inputs.

## Capabilities

### Modified

- `gap-engine`: the "Gap prominence on the person card" requirement gains the approaching-recurrence scenario.

## Impact

- `web/src/components/EvaluationsSection.tsx` — the slot state logic and row rendering.
- Possibly `web/src/lib/person-view.ts` if the slot rows need the due-level precomputed rather than derived in the component.
