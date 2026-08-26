# Tasks: unassigned-tree-node

- [x] 1. `gap-dashboard.ts`: export `UNASSIGNED_NODE_ID`; in `buildGapTree`, when a root center is visible, load `teamId: null` people, gap-compute them, and append the synthetic node (kind TEAM, level null, commander null, sorted last) under the first visible root center.
- [x] 2. `GapDashboard.tsx`: render a gray «ללא שיוך» chip instead of the kind label for the sentinel node.
- [x] 3. `page.tsx`: the «אנשים תחת ניהולי» tile appends «(מתוכם X ללא שיוך)» when X > 0 (X = the synthetic node's total within the current narrowing).
- [x] 4. Verify: `npx tsc --noEmit`; new `web/scripts/verify-unassigned-node.ts` passing twice; `verify-dashboard-filters` + `verify-dashboard-commander` green; `npm run build` clean.
