# Design: org-tree-export

## Approach

One geometry, two printers. A shared layout module turns a (pruned) `GapTreeNode` forest into absolute box/edge coordinates — the classic tidy org-chart: subtree widths computed bottom-up, children centered under their parent, levels top-down. The PPTX writer maps those coordinates to `pptxgenjs` shapes and connector lines; the PDF path renders the same coordinates as an SVG inside a print-styled HTML page and lets the image's chromium print it. Neither printer knows the layout rules.

## Decisions

1. **The server rebuilds, the client only selects.** The dialog posts `{ node?, excludedIds[], showCommander, showCount, format }`; the route runs `buildGapTree(visibility)` (+ the same re-rooting the dashboard does for `node`) and prunes by `excludedIds`. A tampered request can therefore never show more than the requester's own dashboard shows. Session required; `logActivity("org.export", …)`.

2. **Counts are the true rolled-up totals**, taken before pruning — per the user's decision, a box states the framework's real strength even when its sub-branches are hidden. (They are already rolled up in `GapTreeNode.total`; pruning only removes children from the drawing.)

3. **Download via native form POST** from the dialog — the browser saves the response attachment; no blob plumbing. Two submit buttons set `format` to `pptx` / `pdf`.

4. **PPTX**: 16:9 slide; each box a rounded-rectangle shape with up to three centered RTL text lines (name bold; commander line kept — empty — when absent and the toggle is on; count as «N אנשים»); parent→child connectors as line shapes; the whole drawing scaled to fit the slide with a minimum font floor. `pptxgenjs` is pure JS (no binaries) — installed on the connected dev machine and bundled into the image's node_modules like every other package.

5. **PDF**: the route launches the already-present chromium via playwright, renders the HTML+SVG page, `page.pdf` landscape A4 scaled to fit, browser closed in `finally`. Chromium's own text shaping handles Hebrew/RTL — the reason not to hand-write PDF primitives.

6. **Title**: the root of the exported forest («עץ מבנה <name>»); with several roots visible, the first sorted root (the center) — matching what the dashboard shows first.

7. **The synthetic «לא משויכים» node** rides along like any node (included by default, uncheckable like the rest); its box simply has no commander line content.

8. **Wide trees rearrange themselves — the layout has two arrangements.** Measured on a real shape (4 domains × 3 sections × 3 teams, 108 people): spreading every level gives **7950 × 450 units**, which on a page becomes an unreadable 2px-font strip. So the layout is computed at every *stacking depth* — the depth from which children are placed in an indented column (RTL: indented leftward) instead of side by side — and the variant that survives page-fitting best wins. That fixture becomes **1776 × 1138**, aspect 1.56.

   The trigger is not a framework count but the thing a count is a proxy for: **the pyramid stays whenever it still fits the page at full size**, and only a drawing that would have to be shrunk goes looking for a better arrangement (and then only adopts one that helps by >5%). A small tree therefore keeps its pyramid unchanged, which is the point.

9. **Type scales with the drawing, and has no floor.** A fixed 12pt in a box scaled to a quarter inch is *larger than its box* — the reported deformation. Point sizes are now the SVG's own 14/11 layout units converted through the same scale (a point being 1/72 inch), so the two files are visually identical and text can never outgrow its box; `fit: "shrink"` remains as a last-resort guard. Legibility is the layout's job, not the font's, which is what decision 8 is for.

10. **Labels are clipped, never individually shrunk** — text that changed size box to box would read as a broken drawing. The budgets (22 chars for a name, 30 for a line) are *measured*: average Hebrew advance in Arial is 7.19px at bold-14 and 5.23px at regular-11 over the box's 164 usable units.

## Risks

- **Pathologically wide trees** still end with small type — 4pt on the 53-framework fixture. Honest and non-overflowing, and the branch checkboxes let the user prune to what the slide is actually about.
- **pptxgenjs is a new supply-chain member** — pinned version, lockfile committed, no runtime network use.

## Verification

`web/scripts/verify-org-export.ts`: layout unit checks (children centered under parent, no box overlap ANYWHERE, prune removes subtree, counts untouched); the wide-org fixture stacks and stops being a strip while a small tree keeps its pyramid; labels clip to their measured budget; the PPTX's own XML is read back to prove **the type never outgrows its box** (three lines at the largest size fit the shortest box) — the reported deformation, guarded permanently; route checks through a real session — PPTX response unzips (adm-zip) and its slide XML contains the framework names, commander and «N אנשים» per toggles, and omits a pruned branch; PDF response starts with `%PDF` and is non-trivially sized; a request naming a node outside the requester's visibility exports nothing beyond their own scope. Rerun `verify-unassigned-node` (shares the tree build).
