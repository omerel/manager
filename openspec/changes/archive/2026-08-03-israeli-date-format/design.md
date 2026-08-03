## Context

Dates enter the system through four doors and leave through three.

**In:** native `<input type="date">` (six of them), the extraction agent's JSON, a `PersonDraft`'s stored values, and the config/backup import.
**Out:** `fmtDate` (long Hebrew, on cards and lists), `toDateInput` (ISO, into the date inputs), and ISO in the agent snapshot and the portability bundle.

Every parse is the same expression — `new Date(someString)` — in four places: `dateOrNull` (person-actions), `applyItem` (extract-actions), `formatFieldValue` (person-schema), and `draftDate` (people/new). That expression is the defect. Measured on this machine:

```
new Date("03/08/2026")  →  2026-03-07T21:00:00Z
new Date("3.8.2026")    →  2026-03-07T21:00:00Z
new Date("2026-08-03")  →  2026-08-03T00:00:00Z
```

Two separate faults compound: the month-first reading, and a timezone shift (the slash form is parsed as local midnight, then stored as UTC, moving it back a day). Only the ISO form is both unambiguous and timezone-stable.

Storage itself is not at risk: Postgres holds a real timestamp, and the ISO value a native date input submits is unambiguous. The exposure is at the edges — what the agent returns, and what a browser on a US locale shows the user.

The registry today has **no DATE custom-field definitions and no such values**, so nothing stored needs converting.

## Goals / Non-Goals

**Goals:**

- One place that turns text into a date and a date into text, with the Israeli reading as the only reading.
- The same format on screen in a form regardless of the machine's locale.
- An unparseable date is refused, never guessed — especially from the agent.
- Machine interfaces (backup bundle, agent snapshot) stay ISO.

**Non-Goals:**

- Changing storage, or the long Hebrew display form on cards and lists (the user kept it).
- Time-of-day. Every date in this system is a calendar date.
- Locale infrastructure. There is one locale here, and pretending otherwise adds a dial nobody will turn.
- Converting stored custom-field values — measured, there are none.

## Decisions

### 1. A strict parser that has no American branch

`parseIsraeliDate(raw): Date | null` accepts exactly two shapes:

- `d/m/yyyy`, `dd/mm/yyyy`, and the same with `.` or `-` separators
- ISO `yyyy-mm-dd`

and returns `null` for everything else. The day-first reading is the *only* reading — there is no fallback to month-first for `03/08`, and no "try `new Date()` if our parser fails". A fallback is precisely how the American interpretation would creep back in, and it would creep back silently, on exactly the ambiguous dates where it does damage.

Dates are constructed with `Date.UTC(y, m-1, d)`, not `new Date(string)`, so the second fault — the local-midnight shift — cannot occur either. Calendar validity is checked by round-tripping the constructed date back to its parts, so `31/02/2026` is rejected rather than rolling into March.

`formatIsraeliDate(date)` inverts it: zero-padded `dd/mm/yyyy` from the UTC parts.

### 2. Text inputs, not the native date control

A `DateField` component: a text input holding `dd/mm/yyyy`, with `inputMode="numeric"`, an HTML `pattern` so the browser blocks a malformed value before submit, and the format stated in the field.

The native control was tempting — it has a picker, and its submitted value is already ISO. It was rejected on the user's decision, and the reason holds: its *display* is the operating system's business, so on a US-locale machine it shows and accepts `mm/dd/yyyy`, which is the confusion this change exists to remove. A field the application draws is a field the application can guarantee.

The cost is real and worth naming: no calendar picker. Typing eight digits is the price of one format everywhere.

*Alternative considered — native input plus a `dd/mm/yyyy` echo below it.* Keeps the picker, but the value the user reads *inside the box* is still the browser's, so the ambiguity survives where the eye actually lands.

### 3. The form posts `dd/mm/yyyy`; the server parses it

The server actions already funnel through `dateOrNull`, which becomes a thin wrapper over `parseIsraeliDate`. It keeps returning `null` for empty input (optional fields) but now returns `null` for *malformed* input too — so the callers that already throw a Hebrew error on a missing required date cover the malformed case for free, and no action stores a date it did not understand.

### 4. The agent is told what it is reading, and is not trusted anyway

The extraction prompt gains one line: the documents are Israeli and a numeric date in them is day-first. That improves what comes back.

What makes it safe is the second half: `applyItem` and the draft prefill parse whatever arrives through `parseIsraeliDate`. If the agent returns `Aug 3, 2026` or `08/03/2026` from an English-language document, the parser returns null and **the field is dropped from the proposal** rather than applied. The reviewer sees the field absent and types it — which is the honest outcome, because the alternative is a confidently wrong date inside an approval screen designed to be skimmed.

### 5. ISO stays where machines read

`portability.ts` (the backup bundle) and `agent-snapshot.ts` (what the agent is handed) keep ISO. They are not read by people, and ISO is the one form with no reading to get wrong. Changing them would create a second parsing problem on import for no gain.

## Risks / Trade-offs

- **Losing the native date picker** → accepted on the user's decision. The field validates as you type and blocks a malformed submit, so the loss is convenience, not correctness.
- **An Israeli-written date whose day ≤ 12 is indistinguishable from an American one** — `03/08` — and the parser will read it as 3 August, always → that is the point, not a flaw. The system serves one country; a "smart" disambiguation would be a coin-flip dressed as intelligence.
- **The agent silently dropping a date it wrote in another format** → visible: the field is missing from the review, where an absent field reads as "not found" and gets typed. Better than a wrong date that reads as found. Verification asserts the drop happens.
- **A `type="date"` input added later reintroduces the browser's format** → verification greps for `type="date"` in the source and fails if any survives outside the new component.

## Migration Plan

None. No schema change and no stored values to convert (measured: zero DATE field definitions, zero DATE values). Reverting the commit restores the previous behaviour.

## Open Questions

None. The two that mattered — whether to keep the native picker, and whether the long Hebrew display form survives — were settled with the user before this document.
