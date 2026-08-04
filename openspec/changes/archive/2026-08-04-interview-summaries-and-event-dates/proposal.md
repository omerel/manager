## Why

A free entry records **when it was typed**, not when the thing happened. Someone writing up a conference from three weeks ago lands it under today's date, and the record silently misplaces the event. Nothing in the page lets them say otherwise.

There is also no place for an ad-hoc interview. Commanders hold them, they produce a conclusion worth keeping, and today they go into a free entry with the assessment buried in prose — unsearchable, unaggregatable, and indistinguishable from "attended a conference".

## What Changes

- **A free entry gains an event date** — when it happened, distinct from when it was recorded. It defaults to today, so nothing gets slower for the common case of writing something up the same day.
- **Ad-hoc interview summaries become their own kind of entry**: subject, date, optional file, and a **1–5 assessment**. They are listed separately from free entries, because a rated interview and a note about a conference are different things and merging them would make both harder to scan.
- **The 1–5 scale is on interviews only** (the user's decision): 1 אי הצלחה · 2 מתחת למצופה · 3 כמצופה · 4 הצלחה מלאה · 5 מעל המצופה. The number is never shown bare — a stored `3` means nothing to a reader without its label.
- **The assessment is optional** (the user's decision). An interview can be recorded without being rated, and an unrated one carries no value rather than a defaulted one that nobody chose.
- **The structured slots are untouched.** A recurring evaluation occurrence measures whether the plan was met, not how well someone did; giving it the same scale would conflate compliance with quality.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `evaluations-and-events`: an entry records when its event happened; ad-hoc interview summaries exist as a kind, with an optional 1–5 assessment.

## Impact

- `prisma/schema.prisma` — `EvalEntry.kind` (`FREE` | `INTERVIEW`, default `FREE`), `eventDate DateTime`, `score Int?`. One migration, backfilling `eventDate` from `createdAt` — the only defensible value, and the one the page already displays today.
- **New** `src/lib/eval-scale.ts` — the five labels in one place, client-safe, so the form, the list and any later report cannot disagree about what a 3 means.
- `src/lib/eval-actions.ts` — `addFreeEntry` takes the event date; a new `addInterview` takes subject, date, optional file and optional score, validating the score is 1–5 and refusing anything else rather than clamping.
- `src/components/EvaluationsSection.tsx` — the date field on the free form, a new interviews list and form, and both lists ordered by event date rather than by when they were typed.
- `src/lib/agent-snapshot.ts` — the snapshot currently dates each entry by `createdAt` and knows nothing of kind or score. It carries all three now: structuring an assessment and then hiding it from the one surface that can aggregate ("מי קיבל ראיון מתחת למצופה השנה?") would defeat the reason for structuring it.
- Dates use the Israeli `DateField` and the strict parser, like every other date in the system.
- **Not changed**: structured slots, attachments, the gap engine.
