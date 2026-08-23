# Design: dashboard-tree-commander

## Approach

Mirror the hierarchy page, don't invent. `/hierarchy` already answers "who commands this?" with one query — `prisma.user.findMany({ where: { commandsNodeId: { not: null } } })` — mapped into `Map<nodeId, name>`. The dashboard does the same, inside `buildGapTree`, where every node is already being assembled.

## Decisions

1. **The name is stamped on `GapTreeNode`, not looked up in the component.** `GapDashboard` is a client component; it receives serialized nodes and must not query. Adding `commander: string | null` to the type lets every downstream transform (`narrowTree` spreads, `findNode`/re-rooting pass references) carry it for free.

2. **Fetch joins the existing `Promise.all`.** `buildGapTree` already fires two queries in parallel; the commanders query becomes the third. Cost: one indexed query over a table of users.

3. **Visibility is not widened.** The commander's *name* on a framework the viewer can already see leaks nothing — the appointment is organizational fact, and `/hierarchy` shows the same fact to admins. The tree still contains only visible nodes; we label them, nothing more.

4. **Same visual language as `/hierarchy`.** The label is the identical amber badge (`rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900`, text «מפקד: שם»), so the same fact reads the same everywhere. It sits right after the framework name, before the counts on the opposite side.

5. **`level` field precedent.** `GapTreeNode` already carries display-only per-node metadata (`level`); `commander` follows the same pattern — populated at build, consumed at render, ignored by every computation.

## Verification

Extend nothing; add `web/scripts/verify-dashboard-commander.ts`: build the tree for an admin visibility with one commanded and one uncommanded framework (tagged fixtures), assert the commander name lands on the right node and only there, assert `narrowTree` preserves it, and fetch `/` as a signed-in user to see the label in the HTML. Restore fixtures in `finally`.
