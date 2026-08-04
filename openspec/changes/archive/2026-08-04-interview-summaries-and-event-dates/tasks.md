## 1. Schema and migration

- [x] 1.1 `EvalEntry`: `kind EvalEntryKind @default(FREE)` (enum `FREE | INTERVIEW`), `eventDate DateTime`, `score Int?`. Comments state why the score lives only on interviews and why `kind` defaults to FREE (a mislabelled free entry is visible and fixable; defaulting to INTERVIEW would manufacture interviews).
- [x] 1.2 Hand-write the migration: `kind` with its default; `eventDate` added **nullable**, backfilled `= "createdAt"`, then `SET NOT NULL`; `score` nullable. No row momentarily invalid.
- [x] 1.3 The backfill is the acceptance test, not a hope: snapshot every person's entry list (title, displayed date, order) before the migration and after, and assert they are identical.

## 2. The scale

- [x] 2.1 New client-safe `src/lib/eval-scale.ts` — the five values and their Hebrew meanings in **one** place, plus `isValidScore()`. Both the form and the list read it, so no two surfaces can disagree about what a 3 means (the core-fields drift is the precedent).
- [x] 2.2 A helper that renders a score with its label, so a bare number is never displayed.

## 3. Actions

- [x] 3.1 `addFreeEntry` reads `eventDate` through `parseIsraeliDate`, defaulting to today when absent; a malformed date is refused, like every other date in the system.
- [x] 3.2 New `addInterview` — subject (required), event date, optional file, optional score. Validate the score with `isValidScore` and **refuse** anything outside 1–5 rather than clamping; clamping would invent an assessment of a person.
- [x] 3.3 Both write one activity-log entry, naming the person and the kind.
- [x] 3.4 `deleteEntry` already covers both kinds — confirm rather than assume, and check the attachment cleanup path is shared.

## 4. The page

- [x] 4.1 `EvaluationsSection.tsx`: the free form gains a `DateField` defaulting to today.
- [x] 4.2 A new interviews list and form — subject, date, file, and a score select whose options carry the labels ("4 · הצלחה מלאה"), with an explicit empty option so "unrated" is a choice rather than an oversight.
- [x] 4.3 The split becomes two questions asked where each belongs: `recurringEventId == null` still separates plan slots, then `kind` splits the rest. Both lists ordered by `eventDate`, newest first.
- [x] 4.4 A rated interview shows the label; an unrated one shows nothing where a rating would be.

## 5. The agent

- [x] 5.1 `agent-snapshot.ts`: date entries by `eventDate`, and add `סוג` and `הערכה` (the label, not the bare number). Without this "מי קיבל ראיון מתחת למצופה השנה" is unanswerable and structuring the assessment bought nothing.

## 6. Verification

- [x] 6.1 The migration changes nothing: the before/after entry snapshots from 1.3 are identical for all 40 people.
- [x] 6.2 An entry dated three weeks back sorts by its event date, not by when it was created — assert the order, with a second entry created later but dated earlier.
- [x] 6.3 Scores: 1–5 stored and displayed with the right label; 0, 6 and "abc" refused with nothing stored; omitted → null and no rating shown.
- [x] 6.4 A free entry offers no score field, and a plan slot offers neither score nor event date.
- [x] 6.5 Browser: record an interview with subject, date `03/08/2026`, a file and score 2 → stored as 3 August with "מתחת למצופה" and the file reachable; it appears in the interviews list and **not** among the free entries.
- [x] 6.6 The agent snapshot carries `eventDate`, kind and the label — asserted against a generated snapshot, not by reading the code.
- [x] 6.7 Delete throwaway scripts; keep the reusable verification alongside the existing `verify-*` ones. (snapshot-entries.ts deleted — its invariant is proven; verify-interview-entries.ts kept)
