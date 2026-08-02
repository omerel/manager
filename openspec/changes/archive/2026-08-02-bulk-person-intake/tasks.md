## 1. Intake action

- [x] 1.1 New `src/lib/intake-actions.ts`: `startIntake(formData)` — `requireAdmin()`; read all files from the multi-file input; stage every file synchronously before returning; create one `AgentRun` (kind `INTAKE`, prompt = filename) per file in RUNNING state; then process with a concurrency cap of 3.
- [x] 1.2 Per-file job: `materializeDocument` (OCR fallback included) → `runExtraction` with the card schema → compose the extracted full name exactly as the person form does → count exact `fullName` matches.
- [x] 1.3 Route the result: one match → `ExtractionProposal` rows on that person and `output = "person:<id>"`; zero or many → `PersonDraft` and `output = "draft:<id>"`. Failures → run FAILED with the Hebrew reason; each job cleans its temp dir in `finally`.

## 2. Intake page

- [x] 2.1 New `src/app/people/intake/page.tsx` — admin-only (redirect otherwise): multi-file `FileDrop` posting to `startIntake`, plus the queue of this user's recent INTAKE runs with filename, state via `effectiveStatus` (stale timeout included), error text on failures.
- [x] 2.2 Ready rows link by `output` prefix: `draft:` → `/people/new?draft=<id>`, `person:` → `/people/<id>`; mount `AutoRefresh` while any run is live.
- [x] 2.3 People page header: admin-only link "קליטה מרובה ממסמכים" → `/people/intake`.
- [x] 2.4 Verify `FileDrop` supports `multiple`; extend it if not.

## 3. Verification

- [x] 3.1 Batch of 3 real files against the dev server: one matching an existing person exactly (→ proposals on them), one with a fresh name (→ draft), one unreadable (→ FAILED with reason); assert the other two complete.
- [x] 3.2 Ambiguity: two existing people with the same fullName, a file extracting that name → draft, not proposals on either.
- [x] 3.3 Reviewable-as-ready: while one job is still RUNNING, open a finished item's link and complete its approval.
- [x] 3.4 Authorization: non-admin sees no entry link and `/people/intake` redirects; a forged `startIntake` POST under a manager session is refused.
- [x] 3.5 The single-file flow on `/people/new` still works and its one-live-run guard is unaffected by concurrent INTAKE runs.
- [x] 3.6 Delete throwaway verification scripts. (verify-intake.ts kept, rerunnable like the repo's other verify scripts)

## 4. Post-review fix (user testing)

- [x] 4.1 The dropzone lived on a separate page behind a link; the admin dropped files on the people page itself, where nothing caught them. The intake form and queue moved into an `IntakeSection` rendered on `/people` (admin only); `/people/intake` redirects there; `startIntake` lands back on `/people`. Verified: chooser opens from the people page, a dropped file runs to an approvable draft there, a manager sees no dropzone.
- [x] 4.2 A real batch upload died with "Unexpected end of form" (dev log): several scanned documents in one form overflow the 10mb server-action body limit. Raised to 100mb; verified a ~13MB batch creates its runs cleanly.
- [x] 4.3 Root cause of "drag doesn't work / the admin menu won't open": the app was reached at `http://srv-elgrably:4321` but `allowedDevOrigins` listed only the FQDN, so Next **blocked its own dev resources** — HMR and chunks were refused and nothing hydrated. Every client component was dead at once (drag-and-drop, the admin dropdown), while server-rendered pages looked fine; the only trace was a warning in the server log. `next.config.ts` now derives both the bare and fully-qualified hostname from `os.hostname()`. Verified through the user's exact URL: 0 failed `_next` requests, menu opens, drop fills the input.
- [x] 4.4 Standards fix found while investigating: a drop target must cancel `dragenter` as well as `dragover`. Chrome tolerated the omission, Safari would have refused the drop silently. Both are cancelled now, with `dropEffect = "copy"`.
- [x] 4.5 Each ready row now carries an approval route and a cancel button, and a row leaves the queue when it stops needing attention. One rule covers both outcomes: the queue lists a run only while its artifact is still live — approving consumes it (createPerson deletes the draft; resolving the last field deletes the proposal), and `dismissIntakeRun` deletes the artifact and the run. Verified: approve→save clears the row, cancel clears it and discards the draft, the sibling row is untouched, and a run can only be dismissed by the user who produced it (another admin's forged POST left it intact; a manager's was refused).
