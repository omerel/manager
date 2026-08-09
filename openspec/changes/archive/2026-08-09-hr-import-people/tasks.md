## 1. Ground truth first

- [x] 1.1 Backfill test identity values for the eight people without one (user-approved: the data is play data), via a one-off script that refuses to touch a person who already has a value
- [x] 1.2 Enforce identity uniqueness in `person-actions` create/edit — refused by name — and prove re-saving your own value still passes

## 2. The engine (no UI yet)

- [x] 2.1 `src/lib/hr-import.ts`: parse CSV/Excel via the existing `xlsx` dependency into headers + rows, deterministic header recognition over known variants ("ת.ז", "תז", "מס׳ אישי"…)
- [x] 2.2 The agent fallback: headers + 3 sample rows in, proposed column mapping out (JSON schema-checked); structure only, never values
- [x] 2.3 `resolveTeamByName(visibility, raw)` — one resolver, in-scope only, ambiguity is an error naming both candidates
- [x] 2.4 Row classification: two-key identity match in fixed order, key-conflict error, in-scope skip, out-of-scope error, possible-duplicate halt (same full name in scope, no identity value to compare), date parsing through `parseIsraeliDate` or row error
- [x] 2.5 Creation gated by `mayEstablishAt` on the resolved team — the same refusal manual intake gives

## 3. Preview → approve → execute

- [x] 3.1 Upload action producing the preview: every row classified with reason, counts on top, the mapping shown and correctable (correction reclassifies)
- [x] 3.2 Approval executes in the background with a row counter, from the preview's own row set — and re-verifies identity at write time, downgrading a stale create to a reported skip
- [x] 3.3 The run report — created / skipped / errors — kept until dismissed

## 4. The page

- [x] 4.1 `/hr`, role-gated to HR, in navigation for HR users only; direct access refused for others
- [x] 4.2 The import part: file drop, preview table, mapping editor, approve, progress, report
- [x] 4.3 Built as the container the next two parts will join

## 5. The intake addition

- [x] 5.1 The extraction prompt asks for the framework name; the proposal resolves it through the same resolver and leaves it empty when unresolvable
- [x] 5.2 The intake review shows the framework as an editable field of the proposal

## 6. Verification

- [x] 6.1 `scripts/verify-hr-import.ts` — the engine on fixture files: recognised headers, foreign headers (agent mocked or skipped where the model is unavailable), each classification branch, key conflict, possible-duplicate halt, ambiguous team, no-authority row, date refusal, and uniqueness enforcement including own-value re-save
- [x] 6.2 E2E: an HR user uploads a real CSV through the page, corrects a mapping, approves, watches the counter, reads the report; a Manager and an Admin are refused the page; the stale-preview skip proven by racing a create
- [x] 6.3 Existing suites stay green; both new suites twice; `npx tsc --noEmit`; `npm run build`

## 7. Field refinements (user feedback on the first demo)

- [x] 7.1 A foreign DATE FORMAT goes to the agent — column part-order in, deterministic re-parse under it, 31/02 still an honest error; the same structure-not-values line
- [x] 7.2 An unknown/empty/ambiguous framework creates the person UNASSIGNED with a row warning; an authority refusal stays a hard error, since softening it would bypass establishment
- [x] 7.3 Optional faults warn and drop instead of blocking: unreadable optional dates, ENUM values outside their options — the person is taken with the rest
- [x] 7.4 The Admin gets the page, the nav item and the full flow; a Manager stays out
- [x] 7.5 Demo workbook regenerated to exercise every branch, and dry-run through the live pipeline including the real agent (mdy interpreted correctly)
