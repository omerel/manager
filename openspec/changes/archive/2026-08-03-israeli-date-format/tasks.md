## 1. The parser

- [x] 1.1 `parseIsraeliDate(raw): Date | null` in `src/lib/dates.ts` — accepts `d/m/yyyy` with `/`, `.` or `-`, and ISO `yyyy-mm-dd`; nothing else. Builds with `Date.UTC` (never `new Date(string)`, which also shifts by local timezone), and validates by round-tripping the parts back so `31/02/2026` is rejected rather than rolled into March. No month-first branch and no `new Date` fallback — the doc comment states why, with the measured `03/08/2026 → 2026-03-07` as the example.
- [x] 1.2 `formatIsraeliDate(date): string` — zero-padded `dd/mm/yyyy` from the UTC parts. `fmtDate` (long Hebrew) stays as it is; both live side by side and the comments say which is for reading and which for entry.
- [x] 1.3 Property test as part of 6.1: for a few thousand dates, `parseIsraeliDate(formatIsraeliDate(d))` returns the same day.

## 2. The input control

- [x] 2.1 New `src/components/DateField.tsx` — a text input, `inputMode="numeric"`, `pattern` blocking a malformed submit natively, placeholder and title stating `dd/mm/yyyy`, value round-tripped through `formatIsraeliDate`. Same shape as `OffsetField`, which already solves the "the browser must not reinterpret this" problem.
- [x] 2.2 Replace all six `type="date"` inputs: `PersonFormFields.tsx` (birth, recruitment, placement, end-of-service) and the person card's progress `doneOn` and reading `asOf` forms.
- [x] 2.3 The custom-field renderer's DATE branch uses `DateField` too.

## 3. The parse sites

- [x] 3.1 `person-actions.ts` `dateOrNull` → `parseIsraeliDate`; empty stays `null`, malformed now also `null` so the existing required-field errors cover it. Check every caller treats a malformed value as missing rather than silently skipping the field.
- [x] 3.2 `extract-actions.ts` `applyItem` — parse through `parseIsraeliDate`; refuse (throw the existing Hebrew error) rather than store an unparsed value.
- [x] 3.3 `proposals.ts` — a proposed date that does not parse is dropped from the item list, so it never reaches the review screen.
- [x] 3.4 `people/new/page.tsx` `draftDate` and `person-schema.ts` `formatFieldValue` → the same parser.
- [x] 3.5 Grep: no `new Date(<string>)` left on any user- or agent-supplied value.

## 4. The agent

- [x] 4.1 `agent.ts` extraction prompt: state that the documents are Israeli and a numeric date is day-first, and that `dd/mm/yyyy` or ISO are both acceptable to return.

## 5. Untouched on purpose

- [x] 5.1 Confirm `portability.ts` and `agent-snapshot.ts` still emit ISO, and note in each why (machine interface, no reading convention to get wrong).

## 6. Verification

- [x] 6.1 Parser table, asserted not eyeballed: `03/08/2026`, `3.8.2026`, `03-08-2026` and `2026-08-03` all → 3 Aug 2026; `31/02/2026`, `13/13/2026`, `Aug 3, 2026`, `08/03/2026 read as March` → null; plus the round-trip property over a few thousand dates.
- [x] 6.2 **The old behaviour is genuinely gone**: assert `parseIsraeliDate("03/08/2026")` and `new Date("03/08/2026")` disagree, so the test would fail if anyone reintroduced the native parse.
- [x] 6.3 End to end in the browser: type `03/08/2026` into each date field, save, and assert the stored value is 3 August — for a person's birth/recruitment/placement/end-of-service, a milestone `doneOn` and a metric `asOf`.
- [x] 6.4 A malformed entry (`31/02/2026`) is blocked before submit, and if posted directly the server refuses it.
- [x] 6.5 Extraction: a document written `03/08/2026` yields a proposal for 3 August; a date the parser cannot read is absent from the proposal rather than wrong in it.
- [x] 6.6 Grep guard: no `type="date"` outside `DateField`, and no `new Date(` on a string from a form, a draft or the agent.
- [x] 6.7 Delete throwaway scripts; keep the reusable verification alongside the existing `verify-*` ones. (verify-israeli-dates.ts and verify-dates-e2e.ts kept — both rerunnable)
