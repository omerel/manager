# Tasks: plan-item-guides

- [x] 1. Schema: `guideName / guidePath / guideMime / guideSize` and a nullable `sourceEventId` self-relation (`onDelete: SetNull`) on `PointEvent` and `RecurringEvent`; migration `plan_item_guide`; `prisma generate`.
- [x] 2. `plan-actions.ts`: `uploadItemGuide` / `removeItemGuide` (Admin), replacing deletes the previous file; `deletePlanItem` deletes the item's file.
- [x] 3. `plans/[id]/page.tsx`: the «פורמטים והנחיות» control on point and recurring items — current file named, replace, remove.
- [x] 4. `person-actions.ts`: `assignPlan` sets `sourceEventId` on each copied point and recurring event.
- [x] 5. `person-view.ts`: resolve each row's guideline live through `sourceEventId`; `people/[id]/page.tsx` + `EvaluationsSection.tsx` render the download at the point event and at every recurring occurrence.
- [x] 6. New route serving a guideline file to any signed-in user, with the original filename.
- [x] 7. Interview format: `branding.ts` getter/setter (`interviewFormat*` AppSetting rows), `branding-actions.ts` upload/clear under `requireAdmin`, the block on `system/page.tsx`, and the download beside the interview form.
- [x] 8. Verify: `npx tsc --noEmit`; new `web/scripts/verify-plan-guides.ts` passing twice; `verify-person-vector` + `verify-recurring-score` green; `npm run build` clean.
