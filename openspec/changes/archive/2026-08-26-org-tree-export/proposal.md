# Proposal: org-tree-export

## Why

The dashboard's org tree is the living picture of the structure, but it cannot leave the screen — and the org pyramid is exactly the slide every commander is asked to bring to a briefing. Today that slide is drawn by hand in PowerPoint and drifts from reality. The user asked for one button that turns the displayed tree (narrowing included) into a presentable top-down pyramid — as an editable PowerPoint and as a PDF.

## What Changes

- The dashboard's tree section gains an «ייצוא העץ» button opening a dialog: a checkbox tree of the currently displayed forest (every node toggleable, unchecking prunes its subtree; the synthetic «לא משויכים» included by default), two display toggles — commander name, people count — and two download buttons (PowerPoint / PDF).
- A server route rebuilds the tree from the viewer's own visibility (never trusting a posted tree), prunes it by the selection, and renders a top-down pyramid of frameworks only, titled «עץ מבנה <שם המסגרת הגבוהה ביותר>». Each box: framework name, commander beneath (left blank when none — box heights stay uniform), and the ROLLED-UP people count; pruning hides branches but never changes a shown count.
- **PowerPoint**: real, editable shapes and connectors via `pptxgenjs` — the first new package in a while (pure JS, no binaries; bundled into node_modules at build, air-gap safe).
- **PDF**: zero new packages — the shipped image already carries chromium (`playwright install --with-deps chromium` in the Dockerfile); a print-styled page of the same layout is printed server-side.
- One shared layout module computes the pyramid geometry once; SVG/PDF and PPTX are two renderings of the same coordinates.
- The export writes an activity-log entry.

## Capabilities

### Modified

- `gap-engine`: gains an "Exporting the dashboard tree" requirement (ADDED).

## Impact

- New: `web/src/lib/org-export.ts` (layout + prune), `web/src/app/api/org-export/route.ts` (auth, rebuild, render, file response), `web/src/components/OrgExportDialog.tsx`.
- Edited: `web/src/app/page.tsx` (button in the tree section).
- `package.json`: + `pptxgenjs`.
