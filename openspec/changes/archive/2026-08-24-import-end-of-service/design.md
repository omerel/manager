# Design: import-end-of-service

## Approach

Make it the eighth core target and let the existing machinery carry it. Both flows share `recognizeHeaders` / `proposeMappingWithAgent`, the update's `UpdateTarget` extends `ColumnTarget`, and the write side (`applyItem`) already handles `endOfServiceDate` for the extraction flow — so most of the work is naming the field where the other seven are named.

## Decisions

1. **Optional, no fallback.** In `classifyRows` the date joins the loop as `required: false`, like placement date — but where placement falls back to the recruitment date, service-end simply stays absent. A fallback would invent a value, which the import never does.

2. **Recognition variants**: «תאריךסיוםשירות», «סיוםשירות», «תתש» (the ״ is stripped by `norm`), `endofservice(date)`. «תתש» is unambiguous in this domain.

3. **Deletion via the update flow.** `compareTarget` gains a branch: current from `person.endOfServiceDate`; empty raw with a current value → `{ kind: "delete" }` item (the column is nullable, so emptiness is legal — unlike the three required dates, whose emptiness only warns). `applyItem`'s core-date branch learns one nuance: for `endOfServiceDate`, a delete-kind or empty proposal nulls the column instead of refusing to parse.

4. **`RowPlan.data` carries it as the formatted string** like the other dates, parsed once more at approval (`parseIsraeliDate`) — same round-trip the three existing dates make, so the preview shows exactly what will be written.

## Verification

Extend `web/scripts/verify-hr-import.ts` and `verify-hr-update.ts`? No — those suites are shape-sensitive; a focused new `web/scripts/verify-end-of-service-import.ts` instead: recognition variants hit the target; classify with a service-end column → created person carries the date; unreadable value → row still creates with a warning; update compare → change proposes, emptied cell proposes deletion; applyItem delete nulls the column. Existing hr e2e suites rerun to prove no regression.
