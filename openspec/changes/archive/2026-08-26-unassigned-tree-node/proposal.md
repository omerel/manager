# Proposal: unassigned-tree-node

## Why

People without a framework (`teamId = null` — after a team deletion, or imported without a resolvable framework) vanish from the dashboard entirely: `buildGapTree` loads only people inside visible frameworks, so the tree doesn't show them, the counts don't include them, and «אנשים תחת ניהולי» silently understates. The only trace is an amber note on the admin's hierarchy page. The user asked for them to be first-class on the dashboard: a «לא משויכים» framework always under the center, its people listed, counted in the stat tile with the unassigned count in parentheses.

## What Changes

- `buildGapTree` gains a SYNTHETIC «לא משויכים» node: when the viewer's visibility includes a root center, all unassigned people are loaded, gap-computed like anyone else, and hung as a child of that center. Its counts roll up like any child's — the center's totals, the gauge, and the needs-attention list see these people from now on.
- The node is synthetic: sentinel id, no `OrgNode` row, no commander, not editable anywhere; the tree renders a «ללא שיוך» chip in place of the kind label. It exists only in the dashboard tree — the hierarchy editor, queries and imports are untouched.
- The «אנשים תחת ניהולי» tile counts them and appends «(מתוכם X ללא שיוך)» when X > 0.
- The framework chooser offers «לא משויכים» like any node — narrowing to it works for free.
- No schema change, no new packages.

## Capabilities

### Modified

- `gap-engine`: the "Rollup gap dashboard" requirement gains the unassigned-node behavior and the tile's parenthesized count.

## Impact

- `web/src/lib/gap-dashboard.ts` — the synthetic node in `buildGapTree`, sentinel id export.
- `web/src/components/GapDashboard.tsx` — the chip rendering for the sentinel.
- `web/src/app/page.tsx` — the tile's parenthesized count.
