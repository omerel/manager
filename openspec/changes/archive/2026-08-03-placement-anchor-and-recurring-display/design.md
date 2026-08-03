## Context

`Person.recruitmentDate` is the single origin of the plan timeline. It appears in 130 places across 22 files, but only a handful of them are *load-bearing* — the rest display it or copy it. The load-bearing ones all do the same thing: turn an integer month offset into a calendar date, or measure a person's position along that axis.

```
addMonths(recruitmentDate, offset)     gaps.ts · person-view.ts · MetricCurve.tsx · plan-diagram.ts
monthsSince(recruitmentDate, now)      plan-assignment.ts (preview line)
                                       person-actions.ts   (line stored on assignment)
```

Everything else — the people list, the person card, extraction, the agent snapshot — carries the date as data.

`RecurringEvent` already has a per-event `color` assigned at creation from a stable palette, and the diagram already fans its occurrences out as coloured diamonds. What it lacks is any way to say "draw this one like a real milestone".

The registry today: 40 people, 4 templates, 33 copies, 26 active assignments. Every gap the dashboard shows is anchored to recruitment.

## Goals / Non-Goals

**Goals:**

- One anchor for the whole system: a plan offset resolves through the placement date, everywhere, with no path left on the old one.
- Existing behaviour is bit-for-bit preserved at migration time, because placement is backfilled to recruitment.
- A recurring event can be drawn as labelled cards, one per occurrence, in its own colour.
- The person record keeps recruitment date as history and names end-of-service the way the organisation does.

**Non-Goals:**

- Changing how gap levels are decided, or the waiver override mechanism.
- Deriving placement from anything (an org-assignment history, the team's creation date). It is a field the admin fills.
- Retrofitting real placement dates. The backfill is a defensible default, not an attempt to be right about the past.
- Touching the years.months notation or the storage of offsets as integer months.

## Decisions

### 1. `placementDate` is a required column, backfilled from recruitment

`Person.placementDate DateTime` — required, like the recruitment date it joins. The migration adds it nullable, copies `recruitmentDate` into it, then makes it required, so no row is ever momentarily invalid.

Backfilling with the recruitment date is not a guess dressed as data: it is the assumption the system has been making implicitly since day one — that service here began at recruitment. Writing it down makes the assumption visible and correctable, and guarantees that the day this ships, **every computed date and every gap is identical to the day before**. That invariant is the acceptance test (task 6.1), not a hope.

*Alternative considered — nullable, falling back to recruitment at read time.* Rejected: a fallback is a second anchor living in every call site, and the first one someone forgets is a silently wrong date. A required column has one meaning everywhere.

### 2. The anchor moves in the functions that convert, not at the call sites

Every `addMonths(person.recruitmentDate, …)` becomes `addMonths(person.placementDate, …)`. There is no compatibility shim and no per-caller choice: two anchors coexisting is precisely the defect being fixed.

To stop the old anchor creeping back, the type that gap and timeline code accepts (`PersonForGaps`) requires `placementDate` and the conversion helpers take it explicitly — so a caller that hands over a recruitment date has to say so out loud.

### 3. The waiver line is recomputed on the new axis

The line records "how far into their path this person already was when the plan was handed to them". Measured on the old axis it answers a question about a different timeline, so it moves with the axis: `monthsSince(placementDate, assignedAt)`.

Existing `PlanAssignment.waiverOffsetMonths` values are recomputed in the same migration (the user's decision). With the backfill this recomputation is an identity — every line lands on the value it already had — which is exactly why it is safe to do now: the code path is exercised while it cannot change anything, instead of first running years later against real data.

*Alternative considered — freeze existing lines as historical facts.* Defensible, and identical today. Rejected on the user's call: when a real placement date is later entered, a frozen line would be measured from a date that no longer anchors anything.

### 4. `display` on the recurring event, `CARD` meaning one card per occurrence

A new enum column, `MARKER` (default, today's diamonds) or `CARD`. In `CARD` mode the diagram emits one card per unrolled occurrence, at that occurrence's month, carrying the event's own colour and the repeat icon — the same shape point events and checkpoints already use, which is what "כמו אירועים נקודתיים" asks for.

The cost is honest and worth stating: a 6-month cycle over 6 years is 12 cards, and the diagram grows accordingly. That is the admin's choice per event, the default stays `MARKER`, and the plan page names the trade-off next to the toggle rather than letting the diagram surprise them.

Occurrences drawn as cards are **not** also drawn as diamonds. One event, one representation.

### 5. Anchor wording changes wherever the anchor is named

"גיוס +3.4", "מהגיוס", "מרגע הגיוס", the diagram's base chip and its axis caption all assert what the numbers are measured from. Leaving them would make the UI state something false. They become placement wording, in `plans.ts`, `years-months.ts`, `plan-diagram.ts` and the plan page.

This is the part most likely to be missed, so verification greps for the old wording rather than trusting a walkthrough.

### 6. The end-of-service rename reaches the extraction schema

Renaming the label alone would leave the agent's field list saying "תאריך סיום שירות" while the form says "(תת״ש)". The extraction field list is what the agent matches document text against, so the term the documents actually use belongs there too.

## Risks / Trade-offs

- **A missed call site keeps computing from recruitment** → the type requires `placementDate` so the compiler finds them, and task 6.1 diffs full gap snapshots across the migration: any surviving old-anchor path shows up as a non-identical snapshot, since backfill makes the two dates equal only if everything reads the same field consistently. (Equal values make the *diff* silent, so 6.2 additionally sets a divergent placement date on one person and asserts their dates move.)
- **Editing a placement date silently shifts every date for that person** → true, and already true of the recruitment date today. The person's card shows both dates so the cause of a shift is visible; no warning dialog is proposed.
- **`CARD` mode floods a long plan's diagram** → per-event, default off, and the toggle says what it costs. The admin can turn it back.
- **The rename lands in `CORE_FIELDS` and the extraction list, but stored `PersonFieldValue` labels are untouched** → correct: those are admin-defined fields, not this one.

## Migration Plan

One migration, in order:

1. `ADD COLUMN "placementDate" TIMESTAMP(3)` (nullable).
2. `UPDATE "Person" SET "placementDate" = "recruitmentDate"`.
3. `ALTER COLUMN "placementDate" SET NOT NULL`.
4. Recompute `PlanAssignment.waiverOffsetMonths` from the placement date and `assignedAt` — an identity today, run now so the path is exercised.
5. `RecurringEvent.display` with default `MARKER`.

Rollback is reverting the commit; the columns are additive and old code ignores them.

## Open Questions

None. The two that mattered — what a labelled recurring event looks like on the axis, and whether existing waiver lines move to the new axis — were settled with the user before this document.
