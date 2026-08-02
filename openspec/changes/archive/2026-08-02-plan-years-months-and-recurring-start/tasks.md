## 1. Notation core

- [x] 1.1 New client-safe `src/lib/years-months.ts`: `parseYearsMonths(raw): number | null` (positional month digits, null on months > 11 or malformed) and `formatYearsMonths(months): string`. Doc comment states the `3.1`/`3.10` trap with the failing float example.
- [x] 1.2 Rewrite `formatOffset` in `plans.ts` around the notation ("גיוס +3.4" + words), keeping the `0` case ("מרגע הגיוס").

## 2. Recurring start — model and unroll

- [x] 2.1 Schema: `RecurringEvent.startOffsetMonths Int`; migration adds the column with DEFAULT 0, backfills `= intervalMonths` in the same SQL, then drops the default. `migrate dev --create-only`, edit, `migrate deploy`.
- [x] 2.2 `unrollRecurring(interval, stop, start)` in `plans.ts` and `unrollForPerson(interval, stop, start, …)` in `person-view.ts`: loop from `start`, not `interval`. Update every caller (`plans/[id]/page.tsx`, `plan-assignment.ts`, `plan-diagram.ts`, `gaps.ts`, person-view recurrence rows).
- [x] 2.3 `plan-actions.ts`: `addRecurringEvent` / `updateRecurringEvent` take a required start via the notation parser; validate `0 ≤ start ≤ stop`; `copyPlan` copies it.

## 3. Authoring inputs and displays

- [x] 3.1 Plan page: every offset input (point, checkpoint, recurring start/stop) becomes `type="text" inputMode="decimal"` posting the raw string; interval stays a number field in months. Add the parsed-meaning echo next to notation inputs (client component, reusing the derived-age pattern).
- [x] 3.2 All server actions parsing offsets (`addPointEvent`, `updatePointEvent`, `addCheckpoint`, `updateCheckpoint`) switch to `parseYearsMonths` with Hebrew errors on failure.
- [x] 3.3 Displays: plan-page summaries and occurrence previews, `plan-diagram.ts` labels, person-card recurrence rows, and new `fillSlot` titles use `formatYearsMonths`. Existing stored titles are not rewritten.

## 4. Assignment preview and gaps

- [x] 4.1 `plan-assignment.ts` and `gaps.ts` compile and pass the start through; no threshold logic changes.
- [x] 4.2 Audit `eval-actions.ts` slot handling against the shifted grid — keys are opaque offsets so nothing should break; confirm rather than assume.

## 5. Verification

- [x] 5.1 Round-trip property: `parseYearsMonths(formatYearsMonths(m)) === m` for m in 0..1200, plus the explicit cases `3.1→37`, `3.10→46`, `2.12→null`, `"abc"→null`.
- [x] 5.2 Migration invariant: snapshot every person's gap output on the dev registry before the migration, run it, snapshot again — byte-identical. Occurrence sets per recurring event identical.
- [x] 5.3 Playwright: author a point event as `3.4`, see it echoed and displayed as `3.4`; author a recurring event start 2.0 / interval 12 / stop 6.0 and see occurrences 2.0…6.0; enter `2.12` and see the rejection.
- [x] 5.4 Delete throwaway verification scripts. (snapshot-gaps.ts deleted — its invariant is proven; verify-years-months.ts kept, rerunnable like the repo's other verify scripts)

## 6. Post-review fixes (user testing)

- [x] 6.1 Double-submit created duplicate recurring events (three identical "ח" on מסלול חוקר; a rapid double-click reproduced it — 2 rows). All plan-page add buttons and the shared InlineEdit save now lock while the action is in flight (`SubmitButton`, useFormStatus). Duplicates deleted after confirming nothing referenced them.
- [x] 6.2 The echo under offset inputs read as a unit label; rephrasing it as a readback was not what the user wanted — the caption is now gone entirely, and only a malformed value shows the inline format error.
- [x] 6.3 Diagram axis labels were swallowed by the recurring markers. Root cause was bidi, not spacing: the RTL page flips `text-anchor="end"`, extending labels INTO the fan. Fixed by pinning `direction="ltr"` on the axis texts, plus clearing the fan's actual width. Verified by bbox-intersection: 0 overlaps.
- [x] 6.4 The admin's real session (dev log) hit hard error pages from two more paths, and a dev error page deadens the whole app — reported as "drag and the settings menu stopped working". Fixed: malformed offsets are blocked natively (`pattern` on OffsetField) before the server throw; `deletePlanItem` uses `deleteMany` so a double-click's second delete is a no-op instead of a P2025 crash; the plan-page delete buttons lock while pending.
