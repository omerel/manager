# Tasks: dashboard-tree-commander

- [x] 1. `gap-dashboard.ts`: add `commander: string | null` to `GapTreeNode`; in `buildGapTree`, add the commanders query to the `Promise.all` and stamp each built node from a `Map<nodeId, name>`.
- [x] 2. `GapDashboard.tsx`: render the amber «מפקד: שם» badge beside the framework name when `node.commander` is set.
- [x] 3. Verify: `npx tsc --noEmit`; new `web/scripts/verify-dashboard-commander.ts` (tree stamping, narrowTree preservation, label in rendered dashboard HTML) passing; `npm run build` clean.
