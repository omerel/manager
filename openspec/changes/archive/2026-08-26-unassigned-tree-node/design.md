# Design: unassigned-tree-node

## Approach

A synthetic child, not a real row. Creating an `OrgNode` for the unassigned would leak into everything that walks the org tree — permissions, queries, imports, the hierarchy editor, movements. Instead `buildGapTree` fabricates one `GapTreeNode` at build time; every consumer downstream (rollups, narrowing, the chooser, needs-attention) already treats nodes uniformly and gets the behavior for free.

## Decisions

1. **Sentinel id** `UNASSIGNED_NODE_ID = "unassigned"`, defined in the client-safe `gap-meta.ts` (the client tree must recognize it, and a value import from `gap-dashboard.ts` would drag prisma into the client bundle) and re-exported from `gap-dashboard.ts` for server callers. A cuid can never equal it, and the client component can recognize it without a schema change to `GapTreeNode`.

2. **Placement: a child of the first visible root CENTER**, sorted last among its children. Unassigned people belong to no center, so any placement is a presentation choice; the user asked for "under the highest level". With several visible centers the node appears once, under the first — duplicating it would double-count people in every rollup. When the viewer's visibility includes no root center (a scoped manager), the node does not exist for them: people outside every framework are not "under their management".

3. **Who loads them**: `buildGapTree` adds `teamId: null` people to its person query ONLY when the node will be shown, and runs them through `computePersonGaps` like everyone — a person can be unassigned yet keep an assigned plan, and their overdue items must not disappear with their framework.

4. **Counts roll up honestly.** The node is an ordinary child: the center's totals, the gauge and the needs-attention list now include the unassigned. That is the point of the change — "they shall be counted" — and it means compliance may drop the moment this ships, truthfully.

5. **Rendering**: `kind` stays `"TEAM"` (people hang on it; the collapse-all-teams control naturally includes it), but the component swaps the kind label for a gray «ללא שיוך» chip when `node.id === UNASSIGNED_NODE_ID`. No commander, `level: null`.

6. **The tile** shows the inclusive total; beneath the label, «(מתוכם X ללא שיוך)» — only when X > 0, so the common clean state stays clean.

7. **Untouched**: the hierarchy editor's amber note stays (it is the EDIT surface's cue); `/hierarchy`, queries, HR import all unaffected — none of them read `buildGapTree`.

## Verification

`web/scripts/verify-unassigned-node.ts`: fixture center + team + one assigned and two unassigned people (one with an overdue plan); admin tree — the node exists under the center, holds exactly the unassigned, rolls its red into the center's counts, and `flattenWithPaths` offers it; a manager granted only a domain does NOT get the node; narrowTree/findNode work against the sentinel; the dashboard HTML shows the chip and the tile's «(מתוכם 2 ללא שיוך)». Existing `verify-dashboard-filters` and `verify-dashboard-commander` rerun — both build trees and must stay green.
