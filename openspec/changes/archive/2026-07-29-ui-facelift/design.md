## Context

Facelift+ over a working app: token-level restyle + nav rebuild + a visual dashboard, with zero structural/flow changes. Identity chosen by the owner: modern-warm organizational, dark green / light green / airy white — which aligns with the product's own metaphor (career growth). Screenshot review pinpointed: no logo spot or active-nav state, badge noise, red compliance number, dead empty states, emoji-as-icons inconsistency.

## Goals / Non-Goals

**Goals:**
- One coherent visual language ("צמיחה") applied everywhere via tokens + a handful of shared primitives.
- Nav bar as the identity anchor (logo, active state, grouped admin items).
- Dashboard that impresses and directs action (gauge, bars, attention list).
- Admin-manageable logo with a designed default.

**Non-Goals:**
- No route/flow/IA changes (no sidebar), no dark mode, no mobile-specific pass, no toast system (future), no chat-conversation redesign.

## Decisions

**D1 — Tokens over components-first.**
Define the palette/radius/shadow scale in `globals.css` (@theme): `brand-900 #064e3b · brand-600 #059669 · brand-100 #d1fae5 · brand-50 #ecfdf5 · canvas stone-50 · surface white`. Status stays semantic (red/amber/green). Then extract only the primitives that repeat (Card, SectionTitle, Badge, EmptyState, StatTile); pages keep their structure. *Why:* maximum visual change for minimum structural risk. *Rejected:* adopting shadcn/ui — a dependency and refactor far beyond a facelift.

**D2 — Icons: lucide-react, replacing emoji.**
One consistent stroke style, tintable with brand colors, tree-shakeable. Emoji stay only inside user content (never as UI chrome).

**D3 — Default logomark: inline SVG "growth steps" mark.**
Three ascending leaf/steps strokes in brand greens, designed in-code (no binary asset), rendered as a component so it inherits size/color. *Why in-house:* no licensing, crisp at any size, revert-target for custom logos.

**D4 — Branding storage: tiny key-value AppSetting table.**
`AppSetting { key @id, value }` with `logoPath` as the first key (uploaded file under uploads/branding, served by a public `/logo` route — the login page must show it pre-auth; a logo is not sensitive). Generic table so future branding keys (system name, colors) need no migration. Admin-only settings page hosts the upload/revert.

**D5 — Nav: dark-green bar, light-pill active state, admin overflow.**
`bg-brand-900` bar; logo+name right (RTL); items with lucide icons; active item = `bg-white/15` pill (path-prefix matching via a small client component reading `usePathname`); admin-only items (משתמשים, היררכיה) fold into a settings dropdown; user chip links to /account; dev switcher moves into that dropdown too.

**D6 — Dashboard visuals: hand-rolled SVG, no chart library.**
Ring gauge = one SVG circle with stroke-dasharray (green!); comparison bars = styled divs; attention list = query we already have (people with OVERDUE status → link to card). Collapsible tree via native `<details>`. Per-row permission badges dropped — the level is shown once in the page subtitle instead. *Why no chart lib:* three simple visuals don't justify a dependency (MetricCurve is already hand-rolled SVG).

## Risks / Trade-offs

- **Green is both brand and "met" status** → reserve `brand-*` tints for chrome/actions; status-green appears only in status contexts (badges/dots) — visually harmonious by design.
- **Wide cosmetic sweep can break flows subtly** → structure untouched + full smoke pass (every page renders, key flows re-run) + before/after screenshots.
- **Public `/logo` route** → serves only the configured branding file; path from DB, no user input.
- **Contrast on dark green** → verify white/`brand-100` text on `brand-900` meets AA.

## Migration Plan

1. Tokens + primitives → 2. logo + branding storage/settings → 3. nav → 4. dashboard → 5. page sweep → 6. screenshot + smoke verification. Each step leaves the app fully working; one additive migration (AppSetting).

## Open Questions

- System name next to the logo: keep "ניהול קריירה" hard-coded for now; making it admin-editable is a natural follow-up key in AppSetting (out of scope).
