## Why

The plan page's "ציר זמן (יחסי לגיוס)" is a flat text list — functionally correct but unimpressive for the artifact it represents: a person's career path. The owner wants it as a presentation-grade schematic — a large upward arrow from recruitment to end of service with events branching off it — plus one-click PDF export for use in slide decks. Everything must stay air-gap-safe: no new packages.

## What Changes

- **Career-path diagram** replacing the flat timeline on the plan detail page: a large upward arrow (base = גיוס, tip = סוף השירות), events positioned proportionally by month-offset and alternating sides, each with an icon, label, and offset; metric checkpoints show their targets; recurring events appear as cadence markers along the spine with a legend card. Brand ("צמיחה") colors.
- **Single source of truth, zero dependencies** — the diagram is generated as an SVG string by one pure function (plan data → markup, user text escaped). The page renders it inline; the PDF route reuses it verbatim.
- **"הפק PDF" button** beside the diagram → a download route that wraps the same SVG in a print shell and renders via the already-baked Chromium (same machinery as report PDFs). Portrait A4, presentation-clean.
- **Air-gap guarantee**: hand-rolled SVG + existing playwright/marked stack — `package.json` gains nothing.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `career-plans`: adds a requirement for the visual plan diagram and its PDF export.

## Impact

- New `src/lib/plan-diagram.ts` (SVG builder), plan-page section swap, new download route `/plans/[id]/diagram`. No schema changes, no new packages.
