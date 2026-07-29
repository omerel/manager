## 1. Tokens & primitives

- [x] 1.1 Define the "צמיחה" palette + radius/shadow tokens in globals.css (@theme); switch canvas to warm stone
- [x] 1.2 Install lucide-react
- [x] 1.3 Shared primitives — realized as StatTile/RingGauge + shared class patterns (Card extraction not needed)

## 2. Branding (logo)

- [x] 2.1 Design the default logomark as an inline SVG component (growth-steps motif, brand greens)
- [x] 2.2 AppSetting key-value table (additive migration) + branding helpers (get/set logoPath)
- [x] 2.3 Public /logo route serving the custom logo; component falls back to the default mark
- [x] 2.4 Admin system-settings page: upload logo / revert to default (admin-only)
- [x] 2.5 Logo + system name on the login page

## 3. Nav rebuild

- [x] 3.1 Dark-green bar with logo + name; lucide icons per item
- [x] 3.2 Active-state pill (client pathname matching)
- [x] 3.3 Group admin items + dev switcher into a compact dropdown; user chip → /account + logout

## 4. Dashboard

- [x] 4.1 Greeting header (name + date)
- [x] 4.2 Compliance ring gauge (SVG, green) + recolored stat tiles with icons
- [x] 4.3 Per-framework comparison bars (scope-clipped)
- [x] 4.4 Needs-attention list (overdue people → person cards)
- [x] 4.5 Collapsible org tree without per-row permission badges

## 5. Page sweep

- [x] 5.1 People: table with avatars + status dots; person card: sections with icons, actionable empty states
- [x] 5.2 Chat + rules: cards, icons, green actions, run states restyled
- [x] 5.3 Plans, access, hierarchy, account, login: same treatment
- [x] 5.4 Replace all emoji UI chrome with lucide icons

## 6. Verification

- [x] 6.1 Contrast check on brand-900 backgrounds (AA)
- [x] 6.2 Smoke: every page renders; key flows pass (login, edit person, run rule, ask question, upload logo)
- [x] 6.3 After-screenshots of all pages for review
