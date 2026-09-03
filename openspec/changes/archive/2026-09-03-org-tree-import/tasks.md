# Tasks: org-tree-import

- [x] 1. `web/src/lib/org-import.ts`: parse the file with the HR import's `parseTable`; `recognizeOrgHeaders` proposing a mapping (name / kind / parent / ignore) from header variants, unrecognised columns ignored; `validateOrgRows(rows, approvedMapping)` reporting an unmapped meaning first, then every fault by row (unknown kind, missing parent, wrong parent kind, non-center root, duplicate siblings, cycle, ambiguous parent, empty file), reusing `PARENT_KIND`/`CHILD_KIND`; build the level-ordered plan a clean file describes.
- [x] 2. `org-actions.ts`: `previewOrgImport` (Admin) returning the plan, the faults, and the counted cost — frameworks, grants, queries, commanders, people to be unassigned; `applyOrgImport` (Admin) doing delete-all + insert roots-first in ONE transaction, with an activity-log entry.
- [x] 3. `web/src/components/OrgImport.tsx`: upload, the editable column mapping with its approve step, the fault report by row, the tree the file describes, and the counted confirmation before applying — «אין עץ קיים» when there is nothing to replace.
- [x] 4. `hierarchy/page.tsx`: the import block above the tree, Admin-only.
- [x] 5. Verify: `npx tsc --noEmit`; new `web/scripts/verify-org-import.ts` passing twice; `verify-movements-e2e` + `verify-dashboard-filters` green; `npm run build` clean.
