# Tasks: people-excel-export

- [x] 1. `web/src/lib/people-export.ts`: column catalogue (core fields from `CORE_FIELDS` + every `PersonFieldDef`), each with key/label/getter; `buildPeopleSheet(people, keys)` producing the header + rows (Israeli dates, empty cells for missing values).
- [x] 2. `web/src/app/api/people-export/route.ts`: session + `computeVisibility`, own person query over the visible `where`, filter the requested keys against the catalogue, write the workbook with `xlsx`, attachment response, activity log.
- [x] 3. `web/src/components/PeopleExportDialog.tsx`: checkbox list of the catalogue (all ticked by default), «סמן הכל» / «נקה הכל», the sentence about the filter, form POST; button on `people/page.tsx`.
- [x] 4. Verify: `npx tsc --noEmit`; new `web/scripts/verify-people-export.ts` passing twice; `verify-list-containment` green; `npm run build` clean.
