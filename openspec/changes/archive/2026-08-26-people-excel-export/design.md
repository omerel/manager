# Design: people-excel-export

## Approach

A column catalogue in one module, consumed by both halves: the dialog renders it as checkboxes, the route reads a person through it. Adding a card field to the system therefore adds an export column with no second place to edit — the failure this design exists to prevent.

## Decisions

1. **The catalogue is core fields + `PersonFieldDef` rows.** The core half reuses `CORE_FIELDS` from `person-schema.ts`, which exists precisely so the fixed fields are named once (the card-schema page already had two lists drift apart). Each column is `{ key, label, get(person) }`; custom fields are `field:<defId>` and read from `fieldValues`.

2. **The filter is deliberately ignored — and said out loud.** The user asked for the commander's whole registry, and that is also the safer default: a file sent onward should not silently be missing people because someone left a filter on. The dialog carries the sentence «הייצוא כולל את כל האנשים בראותך — גם אם הטבלה מסוננת», so the behavior is stated where the decision is made rather than discovered in the file.

3. **The server decides who, the request decides what.** The route runs `computeVisibility` + `getVisiblePeople` itself; the request body carries only the chosen column keys. An unknown key is dropped rather than erroring — a stale dialog must not fail an export.

4. **A fuller load than the table needs.** The table's `PersonRow` lacks birth date, placement date and the custom `fieldValues`. Rather than widening `PersonRow` (and paying for it on every page view), the route loads its own query over the same `where` clause the visibility produces.

5. **Values are written typed where it matters**: dates as Israeli-format strings (`fmtDate`) — matching every other date in the system and avoiding Excel's locale reinterpretation — and everything else as text. `—`, the screen's placeholder for "no value", never reaches a cell.

6. **Delivery is a native form POST returning the file** — the pattern the org-tree export already uses, so the browser saves it with no blob plumbing.

7. **No new package**: `xlsx` (SheetJS) is already a dependency for reading import files; `utils.aoa_to_sheet` + `write(..., { type: "buffer" })` covers writing. The sheet is named «אנשים» and the file `אנשים-<date>.xlsx`.

## Verification

`web/scripts/verify-people-export.ts`: plant a small scoped org and people (one with sparse card values, one full); call the route over HTTP with a real session; read the returned workbook back with `xlsx` and assert — the header row matches the chosen labels in order; a person's row carries their real values; unselected fields are absent; an empty value is an empty cell, not «—»; a Manager scoped to one team receives only their own people even when asking for everything; dates read back as Israeli dates; the activity log gained an entry. Fixtures removed in `finally`.
