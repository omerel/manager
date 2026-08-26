# Proposal: long-list-containment

## Why

The registry has outgrown its screens. Measured against a planted 1000-person registry:

| surface | HTML | DOM nodes | screens to scroll | inner scroller |
|---|---|---|---|---|
| אנשים | 1.7 MB | 67,699 | **68** | none |
| דשבורד | 483 kB | 13,480 | **33** | none |
| יומן פעילות | — | — | 7.4 | none |

Not one scroll container exists anywhere in the app's page bodies — every list simply pushes the page taller, and the header scrolls away with it. That is what "לא נראה טוב לעין" is.

The same measurement settles the memory question and **rules work out of scope**: browser heap went 10.5 MB → 28.4 MB and server render stayed at 166–201 ms for 1000 people. There is no memory problem, so no virtualization: this change is about containment, not machinery.

## What Changes

- **Scroll containment**: lists that can grow get a bounded height with their own scrollbar, so the page stays roughly one screen and the surrounding context (headings, filters, totals) stays put. Applied to: the people table body, the users list, each team's people list in the dashboard tree, and the activity log table.
- **A render ceiling on the people table**: the first 100 filtered rows render, with a «הצג עוד» control revealing the next 100 and a line stating «מוצגים N מתוך M». Filtering still runs over ALL loaded rows — narrowing never hides a match — and the ceiling resets whenever the filter changes. This is what cuts the 1.7 MB page into something a browser lays out instantly.
- The header row of a contained table stays visible while its body scrolls.
- No new packages, no schema change, no server-side pagination.

## Capabilities

### Modified

- `people-registry`: the people table gains the ceiling + «הצג עוד» requirement.
- `gap-engine`: the dashboard tree's per-team people lists scroll instead of stretching the page.

## Impact

- `web/src/components/PeopleTable.tsx` — containment + ceiling.
- `web/src/components/GapDashboard.tsx` — per-team list containment.
- `web/src/app/access/page.tsx`, `web/src/app/system/activity/page.tsx` — containment.
- New: `web/scripts/verify-list-containment.ts` (measures the real pages in a browser, as this proposal's numbers were measured).
