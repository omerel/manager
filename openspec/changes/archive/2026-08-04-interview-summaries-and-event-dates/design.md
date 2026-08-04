## Context

`EvalEntry` is already two things wearing one shape. A row with `recurringEventId` set is a **structured slot** — the filled occurrence of a plan's recurring evaluation, keyed `(personId, recurringEventId, occurrenceOffset)`. A row without it is a **free entry**. The page splits them by exactly that test:

```ts
const freeEntries = person.evalEntries.filter((e) => e.recurringEventId == null);
```

An interview summary is a third thing that also has no `recurringEventId`, so with no further discriminator it would land in the free list and be indistinguishable from a note about a conference.

The only date a row carries is `createdAt`, and the page shows it as though it were the event's date. For an entry typed the same day that is true by accident; for anything written up later it is quietly wrong.

The agent snapshot exposes each entry as `{כותרת, תוכן, תאריך: createdAt, קבצים}` — so today it inherits the same misdating, and knows nothing that could answer a question about assessments.

## Goals / Non-Goals

**Goals:**

- An entry says when the thing happened, not only when someone typed it.
- Ad-hoc interviews are their own kind, with an optional 1–5 assessment that means the same thing everywhere it appears.
- Existing rows keep their current meaning exactly.
- The agent can answer questions about assessments, or structuring them was pointless.

**Non-Goals:**

- Scoring the structured slots. A recurring occurrence answers "was the plan met"; an interview answers "how did it go". One scale over both would conflate compliance with quality, and the gap engine would then have two notions of "bad".
- Deriving anything from the score — no averages on the card, no effect on gap status. It is recorded, shown and made queryable; what to conclude from it is the reader's.
- A general typed-entry system. Two kinds, named.

## Decisions

### 1. `kind` on the entry, not a separate table

`EvalEntry.kind: FREE | INTERVIEW`, default `FREE`. An interview shares everything a free entry has — person, title, body, attachments, deletion — and differs by a label, a list, and one optional field. A second table would duplicate the attachment relation and the delete path to express a distinction that is one column wide.

The structured-slot test stays as it is: `recurringEventId == null` still separates plan occurrences from everything else, and `kind` then splits what remains. Two orthogonal questions, each asked where it belongs.

### 2. `eventDate` is required, and backfilled from `createdAt`

Required rather than nullable: a nullable date means every reader needs a fallback, and the first one to forget it displays nothing where a date belongs. The form defaults it to today, so nothing gets slower.

The backfill sets `eventDate = createdAt` for existing rows. That is not a guess — it is exactly what the page has been displaying as the event's date all along, so **the day this ships, every entry reads as it did the day before**. That invariant is the migration's acceptance test.

Both lists then order by `eventDate`, because a list of things that happened should be in the order they happened. This visibly reorders any entry written up late — correctly, and worth stating rather than discovering.

### 3. The scale is five labels in one module, and a bare number is never shown

`src/lib/eval-scale.ts` holds the five, client-safe so the form and the list share them:

```
1 אי הצלחה · 2 מתחת למצופה · 3 כמצופה · 4 הצלחה מלאה · 5 מעל המצופה
```

A stored `3` is meaningless to a reader without its label, and two copies of the wording would drift the way the core-field text did. Every display shows the label; the number appears only alongside it.

Stored as `Int?` rather than an enum: it is an ordered scale, and a future report will want to compare and sort. An enum of five names would force a mapping table at every comparison.

### 4. Optional, and validated rather than clamped

`score` is nullable (the user's decision) — an interview can be recorded without a rating, and an unrated one must carry no value rather than a defaulted one nobody chose.

A submitted value outside 1–5 is **refused**, not clamped to the nearest end. Clamping invents an assessment: a stray `7` would become "מעל המצופה", which is a statement about a person that nobody made.

### 5. The agent sees kind, event date and the score's label

The snapshot dates entries by `eventDate` and adds `סוג` and `הערכה` (the label, not the bare number). Without this, "who had an interview below expectations this year" is unanswerable, and structuring the assessment bought nothing — the agent is the only surface that aggregates across people.

## Risks / Trade-offs

- **Lists reorder for anyone who wrote entries up late** → the intended effect of dating events properly; the backfill makes the first render identical, and divergence appears only as new dates are entered.
- **A rated interview looks like a verdict on a person** → the labels are the organisation's own words, the field is optional, and nothing derives from it. Recording an assessment is not the same as acting on one, and the system does not act on it.
- **`kind` defaults to FREE, so a missed write-path creates a free entry** → the safe direction: a mislabelled free entry is visible and fixable, whereas defaulting to INTERVIEW would silently manufacture interviews.
- **Two lists where there was one** → they answer different questions, and the request described them as different things. The cost is one more heading.

## Migration Plan

One additive migration: `kind` with default `FREE`; `eventDate` added nullable, backfilled from `createdAt`, then made required; `score` nullable. No row is momentarily invalid. Rollback is reverting the commit — the columns are additive and old code ignores them.

## Open Questions

None. Scale scope (interviews only) and whether it is required (optional) were settled with the user before this document.
