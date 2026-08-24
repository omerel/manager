# Tasks: import-end-of-service

- [x] 1. `hr-import.ts`: add `"endOfServiceDate"` to `ColumnTarget`, `CORE_VARIANTS`, the agent's targets + valid set; `classifyRows` optional-date loop entry (no fallback) and `RowPlan.data.endOfServiceDate?`.
- [x] 2. `hr-import-actions.ts`: person creation writes the date when present; `hr/page.tsx`: dropdown option «תאריך סיום שירות».
- [x] 3. `hr-update.ts`: `LoadedPerson.endOfServiceDate` + `compareTarget` branch (change proposes; emptied → deletion item); `extract-actions.ts`: `applyItem` nulls the column on a delete/empty proposal for it.
- [x] 4. Verify: `npx tsc --noEmit`; new `web/scripts/verify-end-of-service-import.ts` passing twice; `verify-hr-import-e2e` + `verify-hr-update-e2e` still green; `npm run build` clean.
