## Context

A plan template is copied per person, and the copy is what the person is measured against:

```
Person ──assignedPlanId──▶ CareerPlan (copy, isTemplate=false, sourceTemplateId→template)
                              ├── PointEvent       ◀── PointProgress ──▶ Person
                              ├── CumulativeMetric ◀── MetricReading ──▶ Person
                              └── RecurringEvent   ◀── EvalEntry     ──▶ Person
                                                          └── Attachment
```

Every progress record has two parents: the person who did the thing, and the plan item it was done against. All three relations cascade on delete of the plan item. `assignPlan` deletes the previous copy, so a reassignment removes the second parent and the record goes with it. Verified against live data inside a rolled-back transaction: 3 milestones, 1 reading and 17 filed evaluations disappeared for one person, leaving only the free-form entry — the one record that points at no plan item.

The second constraint is the timeline. Everything in a plan is an offset from `recruitmentDate`, and the gap engine turns those into dates. That is a deliberate, load-bearing decision — it is why a template schedules everyone identically. It also means that assigning a plan to someone already years into service places most of that plan in their past.

Measured across the four current templates, for a person 40 months in:

| plan | horizon | items already past |
|---|---|---|
| מסלול קליטה מואץ | 24mo | 12 of 12 |
| מסלול חוקר | 18mo | 14 of 23 |
| מסלול מומחה טכנולוגי | 48mo | 18 of 27 |
| מסלול פיקוד וניהול | 72mo | 14 of 29 |

The first row is the edge case: nothing measurable would remain.

## Goals / Non-Goals

**Goals:**

- A person's achievements and filed evaluations survive any plan operation, including transfer, unassignment and template change.
- Transferring records *why* and *when*, so the move is auditable rather than inferred from what is missing.
- Moving someone mid-career does not manufacture gaps for things never asked of them, and does not silently forgive things that were.
- Accumulated values and already-completed milestones can follow the person, by explicit decision.
- The distinction between "not required" and "required and not done" is visible, not buried in a count.

**Non-Goals:**

- Two timelines per person. A second anchor at the transfer date was considered and rejected — see D1.
- Automatic matching of items between plans. Deliberately a human decision.
- Retroactive recomputation of past dashboard numbers. History is a record of what was, not a replayable ledger.
- Multiple concurrently active plans. One active assignment at a time, as today.

## Decisions

### D1 — Keep the recruitment anchor; waive rather than re-anchor

The alternative was to anchor the new plan at the transfer date, so its month 0 is the day of the move. Rejected: it gives the person two clocks, breaks the meaning of "month 48 from recruitment" for anyone who has transferred, and makes two people on the same plan incomparable — the property the previous change worked to establish.

Instead the timeline stays single and continuous, and the transfer is a segment boundary on it:

```
גיוס ────────────────────────────────────────────────▶  one axis
      ├──── מסלול חוקר ──────┤├──── מסלול פיקוד ─────
      │  months 0–40          ││  months 40–72
      │  ✓ ✓ ✗ ✓              ││  waived ≤40 · measured >40
      └─ retained as history ─┘└─ 300 grant hours carried in
```

### D2 — The waiver line is derived, not entered

The default the Admin described — everything older than the person's tenure is ignorable — is exactly the segment start. So the line is the assignment date expressed as a month offset, not a number somebody types.

A manually movable line was considered and rejected as redundant: per-item overrides already give finer control, and a free-form number invites values that contradict the assignment date without recording why.

The line is stored on the assignment rather than recomputed, so that adding an item to the plan later inherits the waiver consistently instead of being born undefined.

**Effective rule:** an item counts if `offsetMonths > waiverLine`, unless an explicit per-item exception says otherwise. Exceptions are stored as deviations, so the common case stores nothing.

### D3 — Waived items stay visible, with their own mark

Two states that both mean "not red today" and mean opposite things:

| state | meaning | where it appears |
|---|---|---|
| **פטור** (waived) | never required of this person — it predates their assignment | the active plan |
| **לא בוצע** (not done) | was required, its date passed, it did not happen | a previous, ended assignment |

Hiding waived items would make the plan look shorter than it is and leave "why is this not counted?" unanswerable. Merging the two marks would let a real failure hide behind a technicality.

### D4 — Carry-over is manual and leaves a trace on both sides

The Admin maps items from the previous plan to the new one. The system lists candidates — same name and unit for a metric, same label for a point event — but nothing is pre-selected. A wrong automatic match would grant credit nobody approved, and would be invisible afterwards.

What a mapping does:

- **cumulative metric** → the recorded value is written onto the new plan's metric, so the next checkpoint measures against the real accumulated figure rather than zero
- **point event** → the new plan's item is marked complete, dated from the original completion

Both sides keep a record. The previous assignment retains the achievement as it was; the new item is marked as completed by carry-over with a reference to its origin. Without the reference, "he already did this" is an assertion with no source, which is precisely what the Admin is being asked to certify.

### D5 — Measurement follows the active assignment only

The gap engine and every rollup read the active assignment. Ended assignments contribute nothing to counts. An item left unmet in an ended assignment is recorded as not done and displayed as such on the person's card, which is what "documented but not counted" means.

Past dashboard figures are not recomputed. A rollup is a statement about the present.

### D6 — Warn when the plan is shorter than the tenure

If every item of the new plan falls before the waiver line, the assignment is legal but measures nothing, and the person reads as healthy because no item is outstanding. That is a silent wrong answer, so the assignment screen says so before it is confirmed. A warning rather than a block: an Admin may knowingly assign a plan that is nearly complete on paper.

### D7 — First assignment follows the same rule

A person recruited three years ago receiving their first plan gets the same treatment as a transfer: everything before month 36 is waived by default. The rule is about the person's position on the timeline, not about whether a previous plan exists. Stated explicitly because it is the case most likely to surprise — there is no "transfer" happening, yet most of the plan arrives waived.

### D8 — Deletion stops being how assignment ends

`assignPlan` and `unassignPlan` no longer delete the copy; they end the current assignment and, for `assignPlan`, open a new one. The existing cascades stay exactly as they are — they become harmless once nothing deletes a copy in the normal course of events.

Template deletion is unaffected: a copy references its template with `SetNull`, so deleting a template already leaves copies intact.

## Risks / Trade-offs

- **Plan copies accumulate — one per assignment per person, each with its full event tree** → they are small rows and the alternative is losing history. Worth watching if someone transfers repeatedly; no cleanup is planned, because the whole point is that they are the record.
- **A waived item can hide a real obligation** → the Admin can turn any item back on during assignment, and waived items stay visible afterwards. The default is deliberately generous because the alternative — a wall of false red — trains people to ignore the dashboard.
- **Carry-over duplicates a metric value into the new copy** → if the original is later corrected the two diverge. Accepted: the ended assignment is a record of what was true then, not a live figure.
- **The assignment flow gets heavier** — what is one click today becomes a review step → mitigated by the common case being "confirm the defaults"; carry-over only appears when there is a previous plan to carry from.
- **Backups silently lose history if the new tables are not added to the bundle** → called out as work, because the table list is hand-maintained and has drifted before.

## Migration Plan

1. Add the new tables; nothing is dropped.
2. For each person with an assigned plan, create an assignment record: the current copy, its template, `assignedAt` from the person's recruitment date (the earliest defensible value — no better information exists), no end date, and a waiver line of 0 so that nothing already being measured stops being measured.
3. Existing progress, readings and evaluations are untouched; they already point at the copy that the assignment now names.

Choosing a waiver line of 0 for existing assignments is deliberate: it preserves today's measurements exactly. Applying the new default retroactively would silently forgive real gaps across the whole population.

Rollback is a code revert; the added tables can stay in place, unread.

## Open Questions

None outstanding. Settled while exploring: the recruitment anchor stays, the waiver line is derived from the assignment date, waived items are marked rather than hidden, carry-over is manual for both metrics and point events, unmet items in ended assignments are documented but not counted, and a plan shorter than the tenure warns instead of blocking.
