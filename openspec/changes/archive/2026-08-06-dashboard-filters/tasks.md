## 1. Reading the choice

- [x] 1.1 Read `node` and `kind` from the address, with `kind` defaulting to all and an unrecognised value treated as all rather than as an error
- [x] 1.2 Resolve the chosen framework within the viewer's visibility, and fall back to full scope with a note when it is not there — deleted, or never theirs
- [x] 1.3 Prove the fallback on both causes separately: a framework that was deleted, and one that exists but belongs to somebody else's scope

## 2. Narrowing by framework

- [x] 2.1 Find the chosen node inside the already-built forest and treat it as the root, rather than rebuilding the tree with a narrower scope — the rollups are already correct at every node, and a second computation would be a second thing to keep in step
- [x] 2.2 Recount the gauge, the tiles and the comparison bars from that root
- [x] 2.3 Point the per-framework comparison at the chosen framework's children, and say plainly when there are none rather than rendering an empty panel

## 3. Narrowing by gap kind

- [x] 3.1 Filter the needs-attention panel by the chosen kind, with all meaning overdue and approaching together
- [x] 3.2 Filter the people listed under each team in the tree, with all meaning every person including those meeting their plan
- [x] 3.3 Leave the gauge and the bars untouched by this choice, and comment why at the point where the temptation to "fix" it will arise
- [x] 3.4 Distinguish the two kinds in the needs-attention panel by their existing colour, so widening the default adds information rather than blurring it

## 4. The controls

- [x] 4.1 A filter row under the greeting: framework by full path, and gap kind
- [x] 4.2 Submit through the address so reload, back and a sent link all work
- [x] 4.3 A clear control when either choice is active, and a plain statement of what is currently being shown

## 5. Verification

- [x] 5.1 `scripts/verify-dashboard-filters.ts` — build a fixture tree with known counts in two branches, and assert that narrowing to one branch reports its numbers and not the other's
- [x] 5.2 Assert the gauge and the bars are byte-identical across all three gap kinds — the property most likely to be broken by a later "improvement"
- [x] 5.3 Assert each kind lists the right people in both places, including that all keeps compliant people in the tree and adds approaching people to the needs-attention panel
- [x] 5.4 Assert a link cannot widen visibility: a framework outside the viewer's scope yields their own scope and none of its data
- [x] 5.5 Run twice in a row, `npx tsc --noEmit`, and `npm run build`
