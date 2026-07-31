## Why

People move between career plans, and the system has no way to express it. Reassigning is the only option, and it does something worse than refusing: it destroys the person's record. Measured on the current data by running the existing assignment path inside a transaction and rolling it back:

```
טל כהן-צדק, before switching plans:  3 milestones · 1 metric reading · 17 filed evaluations
טל כהן-צדק, after switching plans:   0            · 0                · 0
```

Only free-form evaluation entries survive. The cause is structural: `assignPlan` deletes the previous plan copy, and every progress record is a child of a plan item — `PointProgress` of a `PointEvent`, `MetricReading` of a `CumulativeMetric`, `EvalEntry` of a `RecurringEvent` — each cascading on delete. Uploaded documents attached to those evaluations go with them.

The system treats "completed the command course in March 2024" as a detail of a plan-template copy. It is a fact about a person, and it should outlive any plan.

There is a second problem the first one hides. Even with history preserved, moving someone onto a new plan four years into their service would mark every early milestone instantly overdue, because plans are anchored to the recruitment date. A transfer would paint the dashboard red for things nobody ever expected of them.

## What Changes

- **A plan assignment becomes a recorded segment of a person's timeline**, not a replacement of it. The previous copy is retained with the assignment's start, end and the reason for the move, so past achievements — and the documents attached to them — survive.
- **Waivers.** On assignment, items of the new plan that fall before the person's tenure at that moment do not count as gaps. The waiver line is derived from the assignment date; the Admin can then turn individual items back on or off. **BREAKING** relative to today's behaviour: assigning a plan to a long-serving person no longer produces an immediate wall of overdue items.
- **Waived items are shown and marked, never hidden.** "Why is this not red?" must have a visible answer, and the distinction matters: a waived item was never required of this person, while a past-due item in a previous plan was required and was not done. The two look the same in a count and mean opposite things about someone.
- **Manual carry-over.** During assignment the Admin maps items from the previous plan to the new one — cumulative metrics so an accumulated value is not reset to zero, and completed point events so a course already passed is not demanded twice. Matching is a decision, not a guess; the system offers candidates and the Admin chooses.
- **Carry-over leaves a trace on both sides.** The old plan keeps the achievement as history; the new plan's item is marked as completed by carry-over, referencing where it came from. Otherwise "he already did this" is a claim without a source.
- **Measurement follows the active assignment only.** Unmet items from a previous plan are recorded as not done and stop counting as gaps.
- **A warning when the new plan's horizon is shorter than the person's tenure.** Assigning a 24-month plan to someone 40 months in currently leaves nothing measurable at all — they would read as healthy because there is nothing to check.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `career-plans`: a person's assignment to a plan becomes a recorded, ended-or-active segment with waivers and carry-over, rather than a single replaceable pointer.
- `gap-engine`: gaps are computed against the active assignment only, and waived items are excluded from gap counts while remaining visible.
- `people-registry`: a person's card shows the plans they have been on and what was achieved in each.
- `data-portability`: backup and restore cover assignment history, waivers and carry-over records.
- `demo-data`: the generated dataset includes people who have transferred, so the feature has data to exercise it.

## Impact

- `prisma/schema.prisma` — a plan-assignment record (person, copy, template, assigned/ended, waiver line, reason), per-item waiver exceptions, and carry-over records; `PointProgress` / `MetricReading` / `EvalEntry` keep their cascade to plan items, which is now safe because copies are no longer deleted
- Data migration — each person's current assignment becomes the first assignment record; existing history is preserved as-is
- `src/lib/person-actions.ts` — `assignPlan` and `unassignPlan` stop deleting, start recording
- `src/lib/gaps.ts`, `src/lib/person-view.ts` — respect waivers; measure the active assignment
- `src/app/people/[id]` — the assignment flow becomes a review step (waivers + carry-over + reason), plus a plan-history section
- `src/lib/plans.ts` — assignment counts per template consider active assignments only
- `src/lib/portability.ts` — new tables in the bundle
- `scripts/generate-demo-data.ts` — generate transfers
- No new dependency; nothing changes in the air-gap image
