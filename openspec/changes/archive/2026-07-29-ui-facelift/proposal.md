## Why

The app is fully functional but visually generic — scaffold-gray with default blue, no brand identity, no logo spot, no active-nav indication, badge noise in the org tree, a text-only dashboard whose compliance number renders in red (high compliance is good!), and dead-looking empty states. A UI review over live screenshots identified the nav bar and dashboard as the biggest pain points. The product's own metaphor — career *growth* — begs for the chosen identity: dark green / light green / airy white.

## What Changes

- **Design tokens ("צמיחה" palette)** — brand greens (forest #064e3b, action #059669, mint tints), warm stone canvas, soft shadows + rounded-xl instead of hard borders, generous spacing. Rubik stays. Status colors remain semantic (red/amber; "met" green harmonizes with brand).
- **Branding with a default logomark** — a minimal growth-motif SVG logo designed in-house as the default; the **Admin can replace it** with an uploaded image from a new system-settings page. The logo shows in the nav and on the login page.
- **Nav bar rebuilt as the identity anchor** — dark-green top bar, logo + system name, lucide icons per item, a light-pill **active state**, admin pages grouped under a compact menu, user chip + logout; the dev switcher tucks away.
- **Dashboard made impressive and actionable** — greeting header; compliance as a **green ring gauge**; colored stat tiles with icons; **per-framework comparison bars**; an **"needs attention" list** (top overdue people, linking to their cards); the org tree becomes collapsible and loses its repeated permission badges.
- **Consistency sweep over all pages** — shared card/badge/button/empty-state patterns, emoji → lucide icons, actionable empty states ("שייך תכנית ←"), people table with avatars + status dots, same treatment for chat/rules/plans/access/hierarchy/login.
- **No structural changes** — routes, flows, and behavior stay as they are (facelift+, not redesign).

## Capabilities

### New Capabilities
- `branding`: A default in-house logomark, admin-replaceable logo (upload, serve, revert to default), shown in nav and login.

### Modified Capabilities
- `gap-engine`: The rollup dashboard requirement gains visualization scenarios — compliance gauge, per-framework comparison, and a needs-attention list linking to person cards.

## Impact

- **Code**: `globals.css` tokens; new shared UI primitives; `lucide-react` dependency; Header/nav rewrite; dashboard page + components; branding storage (small table) + upload route + admin settings page; cosmetic edits across all pages. No route or flow changes; one additive migration (branding).
- **Verification**: before/after screenshots per page + smoke tests that all pages still render and flows still pass.
