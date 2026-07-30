## 1. Diagram builder

- [x] 1.1 `src/lib/plan-diagram.ts`: pure SVG-string builder — spine arrow, proportional placement, alternating cards, collision nudging, recurring cadence markers, embedded icon paths, escapeXml on all user text
- [x] 1.2 Brand styling: growth gradient spine, base/tip chips (גיוס / סוף השירות), RTL text

## 2. Surfaces

- [x] 2.1 Plan page: replace the flat timeline list with the diagram + "הפק PDF" button
- [x] 2.2 Route `/plans/[id]/diagram` (session-guarded): `?format=pdf` via existing Chromium shell (A4, plan-name filename); `?format=svg` variant

## 3. Verification

- [x] 3.1 Visual check on screen (screenshot) — arrow, events, icons, Hebrew RTL correct
- [x] 3.2 PDF export: download, open, visually verify identical diagram; unauthenticated request denied
- [x] 3.3 Confirm package.json unchanged (air-gap: no new dependencies)
