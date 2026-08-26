# Tasks: long-list-containment

- [x] 1. `PeopleTable.tsx`: scroll wrapper (`max-h-[70vh] overflow-y-auto`) with sticky header + filter rows; render `shown.slice(0, limit)`; «הצג עוד» + «מוצגים N מתוך M»; reset `limit` when the filter changes.
- [x] 2. `GapDashboard.tsx`: bound each team's people list (`max-h-64 overflow-y-auto`).
- [x] 3. `access/page.tsx` and `system/activity/page.tsx`: bound the users list and the activity table the same way.
- [x] 4. Verify: `npx tsc --noEmit`; new `web/scripts/verify-list-containment.ts` (page height, inner scroller, ceiling, «הצג עוד», filter-beyond-ceiling, sticky header) passing twice; `npm run build` clean.
