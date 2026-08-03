## Why

A career plan is measured from the wrong date. Its timeline is anchored to **recruitment**, but what a plan actually describes is a person's path *in this unit* — and someone who arrived after two years elsewhere is measured as though those two years were served here. Every date the system computes for them is wrong by the gap between the two, and so is every gap derived from it.

Two smaller corrections ride along: the end-of-service field is missing the term the organisation actually uses (תת״ש), and a recurring event can only ever be drawn as a small marker on the axis — so a plan whose backbone *is* its annual evaluation cannot show it as the milestone it is.

## What Changes

- **A person gains a required unit-placement date** (תאריך הצבה ביחידה). Existing people are backfilled with their recruitment date, which is the only defensible value and reproduces today's behaviour exactly.
- **BREAKING (semantics): the career-plan axis is anchored to unit placement, not recruitment.** Every offset in a plan — point events, checkpoints, recurring start/stop and every unrolled occurrence — resolves to a calendar date through the placement date. The gap engine, the person's timeline, the assignment preview and the diagram all move together; nothing may keep the old anchor, because two anchors in one system is the bug.
- Recruitment date **remains** a stored, required field of the person record. It is their history; it simply stops driving the plan.
- **The waiver line is measured on the new axis too** — months from *placement* to the moment of assignment — and existing assignments are recomputed accordingly (the user's decision). With the backfill this changes nothing today; it keeps the line meaningful the moment a real placement date is entered.
- **The end-of-service field is renamed** to "תאריך סיום שירות (תת״ש)", in the person form and in the field list handed to the extraction agent, so a document saying "תת״ש" is understood.
- **A recurring event chooses how it is drawn**: as a marker on the axis (the default, unchanged) or as a labelled card at **every one of its occurrences**, like a point event. Each recurring event keeps its own colour, and cards drawn for it carry that colour so several labelled recurrences stay tellable apart.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `people-registry`: the record gains a required unit-placement date; the end-of-service field is named as the organisation names it.
- `career-plans`: plan offsets are anchored to unit placement; a recurring event carries a display mode.
- `gap-engine`: what is due, and when, is computed from the placement date.

## Impact

- `web/prisma/schema.prisma` — `Person.placementDate DateTime`; `RecurringEvent.display` enum (`MARKER` | `CARD`). One migration, backfilling `placementDate = recruitmentDate` and recomputing `PlanAssignment.waiverOffsetMonths`.
- **The anchor touches everything that turns an offset into a date**: `gaps.ts`, `person-view.ts`, `plan-assignment.ts`, `plan-diagram.ts`, `waivers.ts` (the line's basis), `person-actions.ts` (assignment), `agent-snapshot.ts` (what the agent is told), `MetricCurve.tsx`.
- **Wording**: "מהגיוס" / "גיוס +3.4" / the diagram's base chip and axis caption all name the anchor — every one of them changes, in `plans.ts`, `plan-diagram.ts`, `years-months.ts` and the plan page.
- `PersonFormFields.tsx`, `people/new`, `people/[id]`, `card-schema` (`CORE_FIELDS`), `doc-extract.ts` extraction fields, `proposals.ts` current-value mapping.
- `plans/[id]/page.tsx` and `plan-actions.ts` — the display toggle on the recurring form.
- Demo data and seed gain the new field.
- **Not changed**: how gap levels are decided, the waiver override mechanism, the years.months notation, storage of offsets as integer months.
