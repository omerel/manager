## Context

A recurring event is defined once and unrolled into occurrences. Two places do the unrolling, and they disagree in an important way:

```
unrollRecurring(interval, stopMode, stopOffset, previewHorizon = 36)   ← plan page, diagram
  UNTIL_OFFSET    → cap = stopOffset
  END_OF_SERVICE  → cap = previewHorizon                  ← a preview default

unrollForPerson(interval, stopMode, stopOffset, recruitment, endOfService, previewHorizon = 36)
  UNTIL_OFFSET    → cap = stopOffset                      ← no departure clipping at all
  END_OF_SERVICE  + date known → cap = months to departure
                  + date unknown → cap = previewHorizon   ← the same preview default,
                                                            now driving gap computation
```

The second function feeds `computeGaps`. So for a person with no end-of-service date, "36" is not a preview — it is the number of occurrences the organisation is held to. Current data: four recurring events, all `END_OF_SERVICE` with no offset; two of eight people have a departure date. Six people are running on the fallback.

The diagram scales the arrow linearly in months:

```
H = max(520, 210 + max(maxOffset × 24, cards-per-side × 74 + 120))
y(off) = baseY − (off / (maxOffset + 1.5)) × usable-height
```

At today's ranges (24–36 months) that yields roughly 1000px. Migrating events to a 72-month cap would push it near 1900px, and a 6-month event would draw twice as many markers.

## Goals / Non-Goals

**Goals:**

- Every occurrence a person is measured against traces to an explicit decision made in the plan editor.
- A plan produces the same schedule for everyone assigned to it.
- Someone who has left stops accruing overdue occurrences, for every recurring event.
- The diagram stays readable and printable at a 72-month range.

**Non-Goals:**

- Removing `endOfServiceDate` from the person record. It stays and keeps its meaning; it simply stops being a plan-authoring option.
- Dropping the `RecurringStopMode` column. Explicitly retained.
- Per-person overrides of a plan's stop condition.
- Backward compatibility for backup bundles containing `END_OF_SERVICE` rows.

## Decisions

### D1 — The cap is always explicit; there is no default horizon

`unrollRecurring` and `unrollForPerson` lose their `previewHorizonMonths` parameter. The cap comes from `stopOffsetMonths`.

If the value is somehow absent, the event yields **no occurrences** and the UI says so, rather than substituting a number. This is the direct lesson of the defect: the failure mode of a silent default is invisible under-measurement, while the failure mode of an empty list is a visible gap in the plan that an Admin will notice and fix. The form makes the field required, and both write paths always set it, so absence should not occur.

Alternative considered: keep a horizon constant as a safety net. Rejected — that is exactly the mechanism that produced the bug.

### D2 — Departure clipping moves from the mode to the person

```
cap = plan.stopOffsetMonths
if (person.endOfServiceDate) cap = min(cap, monthsBetween(recruitment, endOfService))
```

This is both a simplification (one branch instead of three) and a behaviour fix: an event that stops at month 24 previously kept demanding occurrences from someone who left at month 10.

Clipping is inclusive of the departure month; an occurrence falling exactly on it is still expected, matching how a checkpoint due on a date is expected on that date.

### D3 — Keep the enum, migrate the data, never write the removed value

The column stays with both values. All existing rows move to `UNTIL_OFFSET` with `stopOffsetMonths = 72`; nothing writes `END_OF_SERVICE` afterwards. The runtime reads only `stopOffsetMonths`, so the retained value has no behavioural path.

This was a deliberate call to avoid a destructive schema migration. The cost is that `stopOffsetMonths` stays nullable in the database and the "required" guarantee lives in application code — recorded here so it is a known, chosen debt rather than an oversight.

### D4 — 72 months for migrated events

Chosen by the Admin as a realistic service span. It replaces the effective 36 that the fallback was silently applying, so people gain occurrences rather than losing them — an increase in what is measured, never a retroactive removal of an obligation already filed.

### D5 — The diagram's axis becomes event-ordinal

Positions come from the *sequence* of months in which something happens, not from the calendar distance between them.

```
axis slots = sorted unique months of: point events ∪ checkpoints ∪ recurring occurrences

     72 ─┼─ ◆                  recruitment keeps its own slot at the base
     66 ─┼─ ◆                  a break marker sits between it and the first
     ⋮                         event month, and the slots above are uniform
     12 ─┼─ ◎ ◆
      9 ─┼─ ⚑
      6 ─┼─ ◆
        ╪   ← break
      0 ─┴─ גיוס
```

Height then depends on the number of distinct event months rather than on the span, so a 72-month plan with 6-month cadence occupies the same space as a 36-month plan with 3-month cadence. Slot height is set to the card height plus its gap, which also removes the collision-nudging pass that currently pushes overlapping cards apart.

Each tick keeps its month-number label, so the timing information is preserved. What is lost is proportionality: a 6-month interval and a 24-month interval look alike. The break marker is drawn wherever the axis skips, so the reader is not invited to infer a proportional scale — without it an ordinal axis is misleading rather than merely compressed.

Alternatives considered:

- **Skip only the empty prefix, stay linear** — saves only the months before the first event; a 6→72 plan is still nearly as tall.
- **Compress the pixels-per-month when the range is long** — keeps proportionality but makes dense early events collide exactly where detail matters most.
- **Truncate the diagram at 36 months with a "…" marker** — hides part of the plan, which defeats the purpose of a plan diagram.

### D6 — The PDF export follows automatically

The export renders the same SVG builder, so a bounded height fixes page overflow with no separate work. Worth verifying rather than assuming, since the export prints at a fixed page size.

## Risks / Trade-offs

- **The diagram stops conveying relative durations** → mitigated by month labels on every tick and an explicit break marker; accepted deliberately in exchange for a bounded, printable drawing.
- **Migrated events jump from an effective 36 to 72 months** → people with recruitment dates more than three years back may show newly-overdue occurrences the day the change lands. This is the correction, not a side effect, but it should be expected rather than read as a regression.
- **A retained enum value with no code path** → documented in D3; a future reader could mistake it for a live option. The plan editor no longer offers it, which is the observable truth.
- **Clipping now applies to fixed-month events** → a person who left will show fewer expected occurrences than before. Intended, and it only ever removes demands on someone who is gone.

## Migration Plan

1. Schema stays as is; only data changes.
2. Migration script sets every recurring event with `stopMode = END_OF_SERVICE` to `UNTIL_OFFSET` with `stopOffsetMonths = 72`, and fills any `UNTIL_OFFSET` row missing an offset with the same value. Idempotent, safe to re-run, a no-op on a database already migrated.
3. Person-assigned plan copies are migrated by the same script — they are ordinary `CareerPlan` rows, so they are covered by the same query rather than needing a separate pass.

Rollback is a code revert; the migrated data remains valid under the old code, since `UNTIL_OFFSET` with an offset is a state the old code understands.

## Open Questions

None. Resolved while exploring: 72 months as the migrated cap, retaining the enum column, an event-ordinal axis with recruitment as its own slot and a visible break marker, and no compatibility work for pre-existing backup bundles.
