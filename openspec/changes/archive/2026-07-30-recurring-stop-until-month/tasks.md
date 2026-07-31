## 1. Data migration

- [x] 1.1 Idempotent script `scripts/migrate-recurring-stop.ts`: every recurring event with `stopMode = END_OF_SERVICE`, and any row missing an offset, becomes `UNTIL_OFFSET` with `stopOffsetMonths = 72` — one query covers templates and per-person plan copies. Migrated 4 of 4; a second run reported 0
- [x] 1.2 Confirmed afterwards that no row holds `END_OF_SERVICE` and none is missing an offset

## 2. Unrolling and gaps

- [x] 2.1 `unrollRecurring`: horizon parameter dropped; the cap is the stop offset, and a missing offset yields no occurrences
- [x] 2.2 `unrollForPerson`: same cap, then clipped at the person's end-of-service date when known — applied to every recurring event, which is new behaviour for fixed-month ones
- [x] 2.3 Both 36-month horizon constants removed (plan page and diagram)
- [x] 2.4 An event with no stop month is called out in red on the plan page instead of silently showing an empty occurrence list

## 3. Plan editor

- [x] 3.1 Add and edit forms: the stop-condition select is gone; the month field is required, defaulting to the shared `DEFAULT_STOP_MONTHS`
- [x] 3.2 `addRecurringEvent` / `updateRecurringEvent`: always write `UNTIL_OFFSET`, rejecting a missing or non-positive offset
- [x] 3.3 `copyPlan` and plan assignment carry the offset and write the mode explicitly; the person's copy now also inherits the event colour, which it previously lost
- [x] 3.4 Row summaries and the diagram legend read "עד גיוס +N חודשים" everywhere

## 4. Diagram — event-ordinal axis

- [x] 4.1 Slot list built from the sorted unique months across point events, checkpoints and recurring occurrences; recruitment keeps its own slot at the base
- [x] 4.2 Positions come from slot index with uniform spacing sized to the card height, replacing the proportional `y(off)` mapping
- [x] 4.3 A single break marker, between recruitment and the first slot — the per-boundary notches were dropped as noise once every tick carried a label
- [x] 4.4 Every tick labelled with its month offset; the subtitle states that spacing is not proportional
- [x] 4.5 Collision-nudging pass retired — cards are laid out per slot, alternating sides, with extra rows only when more than two share a month
- [x] 4.6 Height derives from slot count; PDF export verified
- [x] 4.7 Recurring markers drawn only between the first and last point event / checkpoint; the legend keeps the real stop month and notes the drawn span when it differs. A plan with no cards is unbounded, so all its occurrences are drawn

## 5. Verification

- [x] 5.1 A 6-month event stopping at 72 unrolls to 12 occurrences, ending exactly at 72
- [x] 5.2 Two people with different recruitment dates and no departure date are measured identically — the non-determinism that motivated the change is gone
- [x] 5.3 A person marked as leaving at month 10 drops from 12 occurrences to 1 for an event stopping at 72, and the gap engine agrees; an occurrence falling exactly on the departure month is kept. Checked end-to-end on real data and restored afterwards
- [x] 5.4 No code path substitutes a horizon: a missing stop month yields no occurrences, for the plan view and for a person
- [x] 5.5 Existing filed evaluation content still maps to its occurrences after the migration (דנה כהן, מאיה בר)
- [x] 5.6 Two plans with 12 event months render at identical height (1226px) although one spans 72 months and the other 12; a 6-slot plan is shorter (782px); every event month is labelled; break markers present
- [x] 5.7 PDF export of the migrated plan renders (138 KB, valid `%PDF`)
- [x] 5.8 Plan page, person page and gap dashboard all render after the migration, with no page errors
- [x] 5.9 Cards at 9 and 24 with recurrence every 6 to 72 draw ticks 9, 12, 18, 24 only — one break marker, legend still says "עד חודש 72 מהגיוס" plus the drawn-span note; height 1596 → 634. No note when nothing is clipped, and a recurring-only plan still draws 12, 24, 36, 48
