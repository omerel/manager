## Context

Every plan offset — point events, checkpoint targets, recurring stop — is authored in a `type="number"` months field and displayed via `formatOffset` as "גיוס +N חודשים". Storage is integer months throughout (`offsetMonths`, `stopOffsetMonths`, `intervalMonths`).

Recurring events unroll in two places with the same loop shape `for (m = interval; m <= cap; m += interval)`:

- `unrollRecurring(interval, stop)` in `plans.ts` — template-side; callers: plan page preview, `plan-assignment.ts`, `plan-diagram.ts`.
- `unrollForPerson(interval, stop, recruitment, endOfService)` in `person-view.ts` — person-side, clipping at departure; callers: `gaps.ts`, person card recurrence rows.

Both hard-code the first occurrence at `interval`. There is no start column. `EvalEntry` slots are keyed `(personId, recurringEventId, occurrenceOffset)` where the offset is whatever the unroll produced — `fillSlot` accepts the posted offset without checking it against the grid, and bakes "גיוס +N חודשים" into the entry title.

Constraint that shapes everything: **the decimal notation is positional, not numeric.** `3.1` (one month) and `3.10` (ten months) are the same float. Any path that lets the value become a number before the month digits are read — `valueAsNumber`, `parseFloat`, a `type="number"` input normalizing on blur — silently corrupts every month value of 10 or 11.

## Goals / Non-Goals

**Goals:**

- One notation, `Y.M`, for authoring and reading every recruitment-anchored offset; months stay the storage unit.
- A recurring event states when it begins; the early years of a plan stop implying evaluations that were never intended.
- Existing plans mean exactly what they meant yesterday, without a data fix-up beyond the automatic backfill.

**Non-Goals:**

- Changing the interval's unit — it stays "כל N חודשים" (user's decision).
- Changing gap thresholds, waiver math, or anything that consumes offsets as month integers.
- A general duration type. Two functions at the boundary, nothing more.

## Decisions

### 1. Parse the string, never the float

`parseYearsMonths(raw: string): number | null` in a client-safe module: split on the dot, years = integer part, months = the digit run after it read as an integer, `null` on months > 11 or malformed input. `formatYearsMonths(months: number): string` inverts it (`40 → "3.4"`, `34 → "2.10"`). Round-trip property: `parse(format(m)) === m` for every non-negative integer — asserted in verification over 0..1200.

Inputs move from `type="number"` to `type="text" inputMode="decimal"` with a pattern hint, because a number input's normalization is exactly the float path the notation forbids. Server actions receive the raw string and parse it; a parse failure throws the field's Hebrew error rather than storing a guess.

*Alternative considered — two fields (years + months).* Immune to the `3.10` trap by construction, but it doubles every offset input on a dense editing page and contradicts the user's explicitly requested format. Rejected.

### 2. The interval keeps its months field

Everything anchored to recruitment (point offsets, checkpoints, start, stop) speaks the notation; the cadence ("כל 6 חודשים") stays a plain months number. The boundary is semantic: anchored positions are dates in a career, cadences are durations — and `0.6` for a half-year cadence was judged less readable than "6 חודשים" by the person who reads it.

### 3. `startOffsetMonths`, first occurrence at the start itself

New required column on `RecurringEvent`. Unroll becomes `for (m = start; m <= cap; m += interval)` in both unroll functions — same grid logic template-side and person-side, so the eval-slot keys a person already has keep matching the offsets the plan produces.

Backfill inside the migration SQL: `startOffsetMonths = intervalMonths`. With the new loop that reproduces the old sequence exactly (`interval, 2×interval, …`), so **no existing occurrence, gap, waiver, or filled slot moves**. This is the invariant the whole change hangs on, and it is verified, not assumed (task 5.2: byte-identical gap snapshots across the migration).

Validation at authoring: start required, `0 ≤ start ≤ stop`. Start = 0 stays legal — "לא מתחילים ישר מגיוס" is the *default posture* (the form's initial value is one interval), not a prohibition; an explicit day-one occurrence remains expressible.

### 4. Slot titles stop baking months into text

`fillSlot` writes `גיוס +N חודשים` into the entry title, which would fossilize the old notation in stored rows. New titles use `formatYearsMonths`; existing titles are left alone — they are historical text, and rewriting history for a formatting change is exactly the kind of silent data edit this project avoids.

## Risks / Trade-offs

- **`3.1` read as "3.10" by a hurried admin** → the parse echo: next to each notation input the page shows the parsed meaning in words ("3 שנים וחודש") the way the age field already derives from birth date. The number is authoritative; the words catch the misread.
- **A stray float path reintroduces the corruption** (someone later "simplifies" to `parseFloat`) → the round-trip test in verification pins `2.10`, and the parser's doc comment states the trap with the failing example.
- **Backfill misses and existing plans shift** → the migration UPDATE and the unroll change land in the same commit, and task 5.2 diffs gap output before/after on the dev registry. A shift is a red diff, not a surprise in production.
- **`fillSlot` accepts off-grid offsets today and still will** → out of scope, unchanged behavior; noted so it is a known hole rather than a discovered one.

## Migration Plan

One Prisma migration: `ALTER TABLE "RecurringEvent" ADD COLUMN "startOffsetMonths" INTEGER NOT NULL DEFAULT 0;` followed by `UPDATE "RecurringEvent" SET "startOffsetMonths" = "intervalMonths";` then drop the default. Deploys through the existing entrypoint (`migrate deploy`); rollback is reverting the commit — the column is additive and old code ignores it.

## Open Questions

None. Scope of the notation, first-occurrence semantics, and the interval exception were settled with the user before this document.
