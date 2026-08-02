## 1. Storage

- [x] 1.1 Add `deleteUploadDir(personId)` to `src/lib/storage.ts`: recursive removal of `uploads/<personId>/`, resolved through the existing uploads-root guard, best-effort like `deleteUpload` (never throws), documented with the same reasoning.

## 2. Person deletion

- [x] 2.1 Extend `getVisiblePeople` in `src/lib/people.ts` with the confirmation counts, loaded with the list, not on demand: `_count` over `planAssignments`, `evalEntries`, `pointProgress`, `metricReadings` in the existing query, plus one query for attachments (`Attachment` is a child of `EvalEntry`, out of `_count`'s reach). No field-value count — decided out in design 5.
- [x] 2.2 Add `removePerson(formData)` to `src/lib/person-actions.ts`. `requireAdmin()`; collect copy ids from `planAssignments` **and** `assignedPlanId`; in one `$transaction` delete the person first, then those copies; after the transaction commits call `deleteUploadDir`.
- [x] 2.3 Revalidate `/people`, `/plans`, `/hierarchy` and the dashboard layout so the person disappears from every count that included them.

## 3. Plan template deletion

- [x] 3.1 Add an unclipped `countAllAssignmentsByTemplate()` to `src/lib/plans.ts` for the confirmation — `countAssignmentsByTemplate` clips to the caller's visibility and would understate who is affected. Have `getPlans` carry the item counts it already selects through to the confirmation.
- [x] 3.2 Add `removePlan(formData)` to `src/lib/plan-actions.ts`. `requireAdmin()`; refuse if the plan is not a template (`isTemplate: false`) so a copy can never be deleted through this path; delete the template and let the existing cascades take its items and the `SetNull` detach the copies.
- [x] 3.3 Revalidate `/plans` and `/people` (the people list's plan links change).

## 4. Confirmation UI

- [x] 4.1 Extract the delete-confirmation modal from `HierarchyTree.tsx` into a shared `ConfirmDelete` component — red header with the `AlertTriangle`/`X` icons, body slot, cancel plus a destructive confirm button whose label states the consequence — and re-point `HierarchyTree` at it so there is one implementation, not two.
- [x] 4.2 `PeopleTable.tsx`: an admin-only actions column with a `Trash2` button per row; the modal renders the counts already carried on the row, with no loading state; submitting posts `removePerson`. Pass `admin` down from `src/app/people/page.tsx`, which already calls `isAdmin()`.
- [x] 4.3 New `PlanRowActions` client component holding the existing `copyPlan` form plus the delete control and its confirmation; use it from `src/app/plans/page.tsx` so the page stays a server component.
- [x] 4.4 Confirmation copy in Hebrew. For a person: only the non-zero counts, and when every count is zero, "לאיש הזה אין היסטוריה במערכת — רק הרשומה עצמה תימחק" rather than a column of zeroes. For a template: the item counts, the number of people holding a copy, and an explicit statement that their plan and progress are unaffected — and, when nobody holds a copy, say that instead of warning about nobody.

## 5. Core-field text on the card-schema page

- [x] 5.1 Export `CORE_FIELDS` from `src/lib/person-schema.ts`: the labels the person form actually renders — שם פרטי · שם משפחה · תאריך לידה · תאריך גיוס · סטטוס · תאריך סיום שירות — plus the per-person attributes that are equally fixed but live outside that block: שיוך לצוות · תמונת פרופיל · מסלול קריירה. Comment it as the single source both texts read from.
- [x] 5.2 `src/app/people/card-schema/page.tsx`: rewrite the description (line ~20) and the banner (line ~33) to render from `CORE_FIELDS`, so neither spells the list out and they cannot drift apart again. Keep the description's second sentence — what the Admin does define — since that is the page's purpose.
- [x] 5.3 Verify against the form, not against the text: read `PersonFormFields.tsx` and confirm every field it renders appears in `CORE_FIELDS` and nothing in `CORE_FIELDS` is absent from a person's card.

## 6. Verification

- [x] 6.1 Prove the person deletion leaves nothing: create a throwaway person with an assignment, a copy, progress, a reading and a photo; delete; assert zero rows across every child table, zero plan copies, and the uploads directory gone.
- [x] 6.2 Prove the template deletion is inert for people: pick a template with copies, record the assigned people's gap status and plan-copy ids, delete the template, assert the copies survive, `sourceTemplateId` is null, and gap status is byte-identical.
- [x] 6.3 Prove authorization: call `removePerson` and `removePlan` as a non-admin session and assert both are refused and nothing is deleted.
- [x] 6.4 Prove `removePlan` refuses a plan copy id.
- [x] 6.5 Playwright: as admin, delete a person from the list and confirm the row is gone after reload; as a non-admin, confirm no delete control is rendered on either page.
- [x] 6.6 Confirm the people page did not get slower in a way that matters: time `getVisiblePeople` before and after the added counts against the current 40-person registry, and record the number.
- [x] 6.7 Load `/people/card-schema` and read the two texts side by side against `PersonFormFields.tsx` — the check is that they name the same fields, not that they render.
- [x] 6.8 Delete the throwaway probe scripts `web/scripts/probe-delete.ts` and `web/scripts/probe-counts.ts`.
