# Proposal: org-tree-import

## Why

The org tree is built one framework at a time, in a form that takes a name, a kind and a parent — fine for a correction, hopeless for standing a unit up. A real structure arrives as a list somebody already keeps in Excel: dozens of rows, four levels deep. Today that means dozens of submissions in the right order, and one mistake in the middle leaves a half-built tree.

## What Changes

- The hierarchy page gains **«ייבוא עץ מקובץ»**: an Excel or CSV carrying three meanings — **שם המסגרת · סוג המסגרת · מסגרת אב** — the kinds being the four the system already has (מרכז / תחום / מדור / צוות).
- **The columns need not be named the system's way.** As with the personnel import, the headers are recognised and a mapping is *proposed*; anything unrecognised is ignored rather than guessed at. The Admin corrects the mapping and approves it, and **validation then runs on the columns they approved** — never on what the system assumed.
- Under that approved mapping the file is **validated whole, before anything is written**, and the preview names every fault by row: an unknown kind, a parent that appears nowhere, a parent of the wrong kind for its child, a root that is not a center, a name repeated at the same level, a cycle, an empty file. **Nothing is fixed in place** — the report is read, the file is corrected, and it is uploaded again.
- Approval **replaces the tree**, and the confirmation states what that costs in real counts read from the database — because it costs more than the tree:

  | what goes | why |
  |---|---|
  | every framework | the tree is replaced, not merged |
  | every **access grant** | grants hang off nodes and cascade — every manager loses their visibility |
  | every **query** and its targets | a query is anchored to the framework that sent it |
  | every commander appointment | released as the framework goes |
  | every person's **framework** | people survive, unassigned — cards, plans and history intact |

- With **no tree at all**, there is nothing to lose: the preview says so and the import simply applies.
- The whole replacement runs in **one transaction** — a half-replaced org is worse than either state.
- Zero new packages: `xlsx` already parses these files for the HR import, and the same parser is reused.

## Capabilities

### Modified

- `org-structure`: gains the tree-import requirement (the file's shape, validation before writing, and what replacement destroys).

## Impact

- New: `web/src/lib/org-import.ts` (parse, validate, build), `web/src/components/OrgImport.tsx`, and the actions behind it.
- Edited: `web/src/app/hierarchy/page.tsx` — the upload block above the existing tree.
- `web/src/lib/org-actions.ts` — the applying action, Admin-only, one transaction, one activity-log entry.
