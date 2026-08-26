# Tasks: org-tree-export

- [x] 1. Add `pptxgenjs` (pinned) to `web/package.json`; install and commit the lockfile.
- [x] 2. `web/src/lib/org-export.ts`: prune by excluded ids; tidy-tree layout (boxes, edges, bounds) from a `GapTreeNode` forest; title derivation.
- [x] 3. `web/src/app/api/org-export/route.ts`: session + visibility rebuild, re-root by `node`, prune, then `format=pptx` → pptxgenjs shapes/connectors; `format=pdf` → SVG-in-HTML printed by playwright chromium; attachment response; activity log.
- [x] 4. `web/src/components/OrgExportDialog.tsx` (client): checkbox tree of the displayed forest, the two display toggles, two-format form POST; button in the dashboard tree section (`page.tsx`).
- [x] 5. Verify: `npx tsc --noEmit`; new `web/scripts/verify-org-export.ts` passing twice; `verify-unassigned-node` green; `npm run build` clean.
