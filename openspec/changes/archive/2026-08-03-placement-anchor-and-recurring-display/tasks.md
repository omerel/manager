## 1. Schema and migration

- [x] 1.1 `Person.placementDate DateTime` and `RecurringEvent.display` (enum `RecurringDisplay { MARKER, CARD }`, default `MARKER`) in `schema.prisma`, each with a comment stating what it anchors / what it draws.
- [x] 1.2 Hand-write the migration: add `placementDate` nullable → `UPDATE "Person" SET "placementDate" = "recruitmentDate"` → `SET NOT NULL`; add `display` with its default. Never leave a row momentarily invalid.
- [x] 1.3 In the same migration, recompute `PlanAssignment.waiverOffsetMonths` from the placement date and `assignedAt` (whole months). An identity today by construction — run it now so the path is exercised while it cannot change anything.
- [x] 1.4 Take a full gap + occurrence snapshot **before** applying the migration (reuse the snapshot approach from the years-months change), then apply and keep it for task 6.1.

## 2. The anchor

- [x] 2.1 `person-view.ts`: `buildPersonTimeline` and `unrollForPerson` resolve every offset through `placementDate`. The end-of-service clip is measured from the same origin.
- [x] 2.2 `gaps.ts`: `PersonForGaps` requires `placementDate` (drop `recruitmentDate` from the type unless the engine genuinely needs it) so the compiler finds every caller; all `addMonths(rec, …)` move to the placement date.
- [x] 2.3 `plan-assignment.ts`: the preview's waiver line is `monthsSince(placementDate, now)`.
- [x] 2.4 `person-actions.ts` (`assignPlan`): the stored `waiverOffsetMonths` is `monthsSince(placementDate, now)`.
- [x] 2.5 `plan-diagram.ts` and `MetricCurve.tsx`: anchor and axis origin.
- [x] 2.6 `agent-snapshot.ts`: the agent is told the placement date and what it anchors, so its answers about "when is X due" agree with the UI.
- [x] 2.7 Grep for surviving `recruitmentDate` uses and confirm each remaining one is display or record-keeping, not offset resolution. List them in the task notes.

## 3. Person record and wording

- [x] 3.1 `PersonFormFields.tsx`: a required "תאריך הצבה ביחידה" field next to the recruitment date; rename the end-of-service label to "תאריך סיום שירות (תת״ש)".
- [x] 3.2 `createPerson` / `updatePerson`: read, validate (required) and store the placement date; reject a missing one with a Hebrew error.
- [x] 3.3 `CORE_FIELDS` in `person-schema.ts` gains the placement date and carries the renamed end-of-service label — the card-schema page derives from it, so both texts follow.
- [x] 3.4 `doc-extract.ts` `extractionFields`: add `placementDate`, rename the end-of-service label to include (תת״ש). `proposals.ts` `currentOf` maps both.
- [x] 3.5 Person card and people list: show the placement date; keep the recruitment date visible so a shifted schedule has a visible cause.
- [x] 3.6 Anchor wording — `plans.ts` (`formatOffset`), `years-months.ts` (`monthsAsWords` "מרגע הגיוס"), `plan-diagram.ts` (base chip "גיוס", axis caption, card subtitles), `plans/[id]/page.tsx` field labels — all name unit placement.

## 4. Recurring display mode

- [x] 4.1 `plan-actions.ts`: `addRecurringEvent` / `updateRecurringEvent` accept `display`; `copyPlan` and the per-person copy in `person-actions.ts` carry it.
- [x] 4.2 `plans/[id]/page.tsx`: a two-option control on the recurring add and edit forms (סימון על הציר / כרטיס בכל מופע), defaulting to the marker, with a one-line note that the card mode draws a card per occurrence.
- [x] 4.3 `plan-diagram.ts`: a `CARD` event contributes one card per unrolled occurrence — label, the repeat icon, the event's own colour — and is excluded from the diamond fan. Card months join the axis slots so occurrences get their own rows.
- [x] 4.4 Legend: a `CARD` event is described as such rather than being listed under the marker legend as if it were drawn there.

## 5. Data and fixtures

- [x] 5.1 `seed.ts` and `generate-demo-data.ts`: set a placement date (equal to recruitment for most, deliberately later for two or three people so the difference is visible in the dev registry) and set `display` on one recurring event to `CARD`.

## 6. Verification

- [x] 6.1 **The migration changes nothing**: diff the pre-migration snapshot against a post-migration one — byte-identical gap output and occurrence sets for all 40 people. Any surviving recruitment-anchored path shows up here only if it disagrees; so pair this with 6.2.
- [x] 6.2 **The anchor really moved**: set one person's placement date three months after their recruitment date, and assert every due date on their card, in the gap engine, in the assignment preview and on the diagram shifts by exactly three months — and that a person whose dates are equal is unchanged.
- [x] 6.3 **The waiver line follows**: assign a plan to a person recruited long ago but placed recently; assert almost nothing is waived, and that the stored line equals months from placement, not from recruitment.
- [x] 6.4 **Required field**: creating a person without a placement date is rejected; the card-schema page lists it among the fixed fields; a document giving תת״ש is extracted into the end-of-service field.
- [x] 6.5 **Display mode**: an event set to `CARD` renders one card per occurrence in its own colour and no diamonds; the same event set to `MARKER` renders diamonds and no cards. Check by counting shapes in the rendered SVG, not by eye.
- [x] 6.6 **No stale anchor wording**: grep the rendered pages and the diagram for "גיוס" and confirm each remaining occurrence is about the recruitment date as a record field, never as the offset origin.
- [x] 6.7 Delete throwaway verification scripts; keep the reusable ones alongside the existing `verify-*` scripts.
