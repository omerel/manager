# Design: recurring-event-score

## Decisions

1. **One flag, one column, no new tables.** `RecurringEvent.withScore` gates the UI; the value reuses `EvalEntry.score` — the same 1–5 column, the same `parseScore` refusal, the same `scoreLabel` pill interviews use. A second score column or scale would make two ratings that mean the same thing.

2. **Migration** `recurring_with_score`: `ALTER TABLE "RecurringEvent" ADD COLUMN "withScore" BOOLEAN NOT NULL DEFAULT false` — default false keeps every existing event, template or copy, exactly as it was.

3. **fillSlot honors the flag server-side**: the score is parsed only when the event has `withScore`; a posted score for an unflagged event is ignored, not an error (a stale form must not block a fill). The upsert writes score on create AND update, so re-filling can change or clear the rating.

4. **The checkbox posts `value="1"`**, read as `=== "1"` — the codebase's boolean-form convention (loginLinkEnabled).

5. **Optional, per the user's decision** — «ללא דירוג» stays a choice on every fill, exactly like interviews.

## Verification

`web/scripts/verify-recurring-score.ts`: author a template with one rated and one plain event through the real actions; assign; assert the copy carries the flag; fill a rated occurrence with 4 → entry.score 4 and the pill in the card HTML; refill with empty → score null; fill the plain event with a smuggled score field → score stays null; out-of-range refused. Existing `verify-recurring-display` + `verify-card-approaching` rerun.
