## 1. Schema and migration

- [x] 1.1 `PlanAssignment`: person, plan copy, `templateName` snapshot, `assignedAt`, `endedAt` (null = active), `waiverOffsetMonths`, `reason`
- [x] 1.2 `PlanWaiver`: a deviation from the line for one item, via typed FKs (point / checkpoint / recurring occurrence) rather than a polymorphic id, so integrity and cleanup are the database's job
- [x] 1.3 `PlanCarryOver`: kind, snapshotted origin plan and label, the target item, the value or date
- [x] 1.4 `Person.assignedPlanId` retained as the active pointer; history lives in `planAssignments`
- [x] 1.5 `scripts/migrate-plan-assignments.ts` — 28 of 28 assigned people got a record, `assignedAt` from recruitment, **waiver line 0**
- [x] 1.6 Verified nothing was touched: gap status captured for all 40 people before and after, byte-identical

## 2. Assignment stops deleting

- [x] 2.1 `assignPlan` ends the current assignment and opens a new one; the copy is built item by item so every template id maps to its copy id
- [x] 2.2 `unassignPlan` ends the assignment and clears the pointer, keeping the copy
- [x] 2.3 Regression guard run forward through the UI: 3 milestones, 1 reading, 17 filed evaluations and their attachments all survived the transfer that used to erase them

## 3. Waivers

- [x] 3.1 `src/lib/waivers.ts` derives the line from the assignment date via `monthsSince`
- [x] 3.2 One rule, one place: `offsetMonths > line` unless an override says otherwise — applied to point events, checkpoints and recurring occurrences; a per-occurrence override beats a whole-event one
- [x] 3.3 `computePersonGaps`, `buildPersonTimeline` and the dashboard query all consult it — the rollup query needed the assignment too, or it would have counted items nobody was asked for
- [x] 3.4 A metric whose every checkpoint is waived drops out rather than binding on a target that predates the assignment

## 4. Carry-over

- [x] 4.1 Candidates matched by name+unit for metrics and label for point events, offered unselected
- [x] 4.2 A metric mapping writes the value onto the new plan's metric
- [x] 4.3 A point mapping creates the completion with the original date
- [x] 4.4 Credit is an ordinary progress record; `PlanCarryOver` is the provenance that lets the card say where it came from

## 5. Assignment flow

- [x] 5.1 Choosing a template now opens a review step (`?assign=<id>`) instead of assigning on click
- [x] 5.2 Items listed with their offsets and checkboxes; unchecked = waived. Unchecked boxes submit nothing, so the form carries the full item list and the action derives intent from the difference
- [x] 5.3 The carry-over section appears only when there is a previous plan
- [x] 5.4 Warning when every item falls at or before the line, still confirmable
- [x] 5.5 `PlanHistorySection` on the card: periods, reason, completed and unmet per assignment
- [x] 5.6 `WaivedBadge` and `CarriedBadge` — waived items shown and marked on points, metrics and occurrences, distinct from "not done"

## 6. Everything that reads assignments

- [x] 6.1 `countAssignmentsByTemplate` already counts through the active pointer, so ended assignments cannot inflate it — verified: 27 active assignments, 27 pointers, 4 ended
- [x] 6.2 `portability.ts` dumps and restores the three new tables, in an order that respects their parents
- [x] 6.3 Agent snapshot exposes previous plans and the waiver line, so questions about a person's history can be answered
- [x] 6.4 Generator produces transfers with ended assignments, waived items and carried values

## 7. Verification

- [x] 7.1 Transfer through the UI: milestones, readings, 17 filed evaluations and attachments all intact — the failure measured in the proposal no longer reproduces
- [x] 7.2 Unassigning preserves everything and ends the assignment rather than deleting it
- [x] 7.3 A person 55 months in, assigned a 72-month plan: 5 of 23 items required, the rest waived by default
- [x] 7.4 Both override directions stored — waiving a required item, and requiring a waived one (line 268, override `waived:false`)
- [x] 7.5 A carried metric lands on the new plan: 25 שעות גמול השתלמות measured against the next checkpoint rather than zero
- [x] 7.6 The card states the origin — "הועבר מ<מסלול>"
- [x] 7.7 No candidate is pre-selected
- [x] 7.8 A transferred person's gap items come only from the active assignment
- [x] 7.9 The 24-month plan assigned to a 268-month person warns and stays confirmable
- [x] 7.10 First plan for a person with no previous assignment waives by the same rule — 29 of 29 items, no carry-over section
- [x] 7.11 Migration left every person's gap status exactly as it was
- [x] 7.12 Backup round trip: 31 assignments, 4 ended, 2 waivers, 1 carry-over, 114 evaluations — identical after restore
- [x] 7.13 Template assignment counts unaffected by ended assignments
