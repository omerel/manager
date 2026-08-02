## Why

Creating people from documents works one file at a time: upload on `/people/new`, wait for the extraction, review, save, repeat. Onboarding a cohort — or refreshing a pile of personnel files — multiplies that wait by N, with the admin as the loop variable. The extraction pipeline (background agent run → prefilled draft → human review) already exists; what's missing is fan-out and a queue to review from.

## What Changes

- **The admin can drop multiple files at once**, each file representing one person. Every file gets its own background extraction job; jobs run concurrently (capped) and fail independently — one unreadable scan does not sink the batch.
- **A file whose extracted full name exactly matches one existing person becomes an update proposal** on that person, reviewed field-by-field through the existing proposal mechanism. No match — or an ambiguous match — becomes a new-person draft. So the same drop handles both "new employees" and "updated files for existing ones".
- **An intake queue shows each file's state** (מעבד / מוכן / נכשל) and links each ready item to its review — the prefilled new-person form or the person's card with pending proposals. **Ready items are reviewable immediately**, while other files are still processing; the admin approves one by one, never as a bulk "accept all".
- Admin-only, per the request. The single-file flow on `/people/new` is untouched.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `data-ingestion`: bulk intake — concurrent per-file extraction, name-matching to existing people, and a reviewable-as-ready queue. The no-autonomous-write principle is restated for the bulk path: N files still write nothing without N human approvals.

## Impact

- `src/lib/extract-actions.ts` (or a new `intake-actions.ts`) — a multi-file action fanning out background runs with kind `INTAKE`, so the existing one-live-`EXTRACT`-per-user guard on the single flow is not tripped; a small concurrency cap.
- Matching: exact trimmed `fullName` equality; exactly one match → `ExtractionProposal` rows on that person, else → `PersonDraft`.
- New page `src/app/people/intake/page.tsx` — drop zone + queue over the user's recent INTAKE runs, auto-refreshing while any run is live (same mechanism as `/people/new?extracting=1`); linked from the people page, admin-only.
- Reuses as-is: `materializeDocument`/OCR, `runExtraction`, `PersonDraft`, `ExtractionProposal`, per-field approval UI, `jobs.ts` status model.
- No schema change expected (`AgentRun.kind` is a string field; verify, don't assume).
