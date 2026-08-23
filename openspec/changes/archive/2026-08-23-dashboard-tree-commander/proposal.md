# Proposal: dashboard-tree-commander

## Why

The gap dashboard's org tree is the screen a manager actually lives in, yet it names only frameworks — never who commands them. The chain of command is already recorded (`User.commandsNodeId`) and already shown on the `/hierarchy` admin page as a «מפקד: שם» label; the dashboard, seen by every signed-in user, hides it. A commander looking at a sibling framework's red counts has to leave the dashboard to learn who to call.

## What Changes

- `buildGapTree` also loads the users who command a framework and stamps each visible node with its commander's name (`commander: string | null`).
- The dashboard tree (`GapDashboard`) renders the commander beside the framework name as a label, in the same amber-badge form the hierarchy page already uses; frameworks with no commander render nothing extra.
- No schema change, no new packages, no new settings — the appointment mechanism and its rules are untouched.

## Capabilities

### Modified

- `gap-engine`: the "Rollup gap dashboard" requirement gains a scenario — commanded frameworks are labelled with their commander's name in the dashboard tree.

## Impact

- `web/src/lib/gap-dashboard.ts` — `GapTreeNode` gains `commander`, `buildGapTree` fetches and maps commanders.
- `web/src/components/GapDashboard.tsx` — the node row renders the label.
- Everything downstream of `GapTreeNode` (`narrowTree`, `findNode`, re-rooting) spreads or passes nodes through, so the field rides along untouched.
