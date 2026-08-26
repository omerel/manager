# Proposal: people-excel-export

## Why

The registry is the system's source of truth about people, and there is no way to get it out of the screen. Every request that starts «תשלח לי את הרשימה» ends in someone retyping the table into Excel — with the errors that implies. The people page can already show the list; it cannot hand it over.

## What Changes

- The people page gains an «ייצוא לאקסל» button opening a dialog: a checkbox list of **every value a person's card carries** — the fixed core fields (שם פרטי, שם משפחה, תאריך לידה, תאריך גיוס, תאריך הצבה, סטטוס העסקה, תת״ש, שיוך לצוות, מסלול קריירה) and every Admin-defined card field — **all ticked by default**, with «סמן הכל» / «נקה הכל».
- A server route builds a real `.xlsx` from the requester's **whole visible registry — deliberately NOT the on-screen filter**, per the request: the file answers "everyone under my command", so a filter left on the table cannot silently truncate what someone sends onward. The dialog says so in a line, so the difference is never a surprise.
- One header row of the chosen labels, one row per person, in the same Hebrew-sorted order the table uses; dates written as Israeli dates; an empty value written empty rather than as «—».
- Zero new packages: `xlsx` is already a dependency (the HR import reads with it); this writes with it.
- The export writes an activity-log entry naming how many people and how many columns left the system.

## Capabilities

### Modified

- `people-registry`: gains an "Exporting the registry to Excel" requirement.

## Impact

- New: `web/src/lib/people-export.ts` (column catalogue + row building), `web/src/app/api/people-export/route.ts`, `web/src/components/PeopleExportDialog.tsx`.
- Edited: `web/src/app/people/page.tsx` (the button), possibly `web/src/lib/people.ts` if the export needs a fuller person load than the table's rows.
