## 1. Data

- [x] 1.1 `PersonRow` carries `planName` and `planTemplateId`
- [x] 1.2 `getVisiblePeople` includes the plan in its existing query, not per row
- [x] 1.3 Both absent states are distinct: `planName === null` (no plan) versus `planName` set with `planTemplateId === null` (template deleted)

## 2. Table

- [x] 2.1 `PeopleTable` is a client component receiving the already-clipped rows
- [x] 2.2 Career-plan column linking to `/plans/<templateId>`
- [x] 2.3 Filter row: text for name, framework and recruitment date; selects for plan and status
- [x] 2.4 Selects are built from the rows themselves, so no offered filter can return nothing
- [x] 2.5 Filters combine; one button clears them all
- [x] 2.6 The `?q=` search box is gone — the name column filter replaces it, and the page no longer reads search params

## 3. Page

- [x] 3.1 Count line reads "מוצגים N מתוך M אנשים" whenever a filter is active
- [x] 3.2 An empty filter result says so inside the table, distinct from "אין אנשים בהרשאה שלך"

## 4. Verification

- [x] 4.1 The plan link opens the template page (`שכפל תכנית` present, and the id appears in the templates list) — not the person's copy
- [x] 4.2 14 people read "ללא מסלול" unlinked; a copy whose template was deleted keeps its name with `sourceTemplateId = null`, so it renders unlinked rather than as "ללא מסלול" — checked inside a rolled-back transaction
- [x] 4.3 Typing in the name filter narrowed 40 → 2 with zero navigations
- [x] 4.4 The plan select offers exactly the five values present; filtering by status works
- [x] 4.5 Two filters together return the intersection (2 → 1)
- [x] 4.6 Clearing restores all 40
- [x] 4.7 `demo.algo` sees 13 of 40, is offered only values present in their own view, and no filter combination raised the row count above 13
- [x] 4.8 The page renders with 40 people; the empty case is handled by the existing branch
