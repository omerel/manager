## Context

The plan page's Timeline section currently renders a sorted `<ol>` of offset rows. All diagram ingredients exist: plan events with offsets, brand tokens, lucide-style iconography, and a Chromium-based PDF pipeline (report downloads). Constraint: air-gap — zero new packages.

## Goals / Non-Goals

**Goals:** presentation-grade upward-arrow schematic; identical output on screen and in the exported PDF; RTL Hebrew; zero new dependencies.
**Non-Goals:** interactivity (zoom/drag), per-person calendar-dated diagrams (template offsets only — a person-card variant is a natural follow-up), PNG export.

## Decisions

**D1 — One pure SVG-string builder shared by page and PDF.**
`buildPlanDiagramSvg(plan) → string`: computes layout and emits complete SVG markup with user text escaped. The page injects it (`dangerouslySetInnerHTML` — our own generated markup with escaping at the entry points); the PDF route wraps the same string in an A4 print shell for Chromium. *Why not JSX + renderToStaticMarkup:* string-building keeps the PDF route free of React-server pitfalls and guarantees pixel-identical output in both surfaces.

**D2 — Layout model.**
Vertical spine: fat arrow (brand-600 gradient fill, arrowhead at top) from y(0 months) at the bottom to y(maxOffset + headroom) at the top; "גיוס" chip at the base, "סוף השירות ↑" label at the tip. Events = cards alternating right/left, connected by elbow lines to the spine at height ∝ offset; same-offset collisions nudge vertically. Cards: icon disc + label + "גיוס +Nח" (+ target for checkpoints). Recurring events: small repeat-dots along the spine at the preview cadence + one legend card ("כל N חודשים עד …"). Height scales with maxOffset (bounded), width fixed viewBox — responsive via `max-width:100%`.

**D3 — Icons as embedded SVG paths, not lucide components.**
The builder emits a tiny hand-written icon set (flag/point, target/metric, repeat/recurring, rocket/base, leaf/tip) as inline paths — lucide React components can't render into a string template, and vendoring paths keeps the function pure and dependency-free.

**D4 — PDF via the existing Chromium pipeline.**
GET `/plans/[id]/diagram?format=pdf` (session-guarded like the plan page): SVG string → minimal RTL HTML shell → `page.pdf({format:"A4"})` — same pattern as report downloads; filename carries the plan name. A `?format=svg` debug variant is free and useful for embedding elsewhere.

## Risks / Trade-offs

- **Dense plans could collide labels** → collision nudging + minimum row spacing; beyond ~20 events the diagram grows taller rather than overlapping.
- **`dangerouslySetInnerHTML`** → all interpolated user strings pass one `escapeXml` helper; nothing else enters the markup.
- **RTL inside SVG** → explicit `direction:rtl` + anchored text; verified visually in both surfaces.

## Migration Plan

Builder → page section swap (+button) → PDF route → visual verification (screen + PDF screenshot review). No data changes.

## Open Questions

None.
