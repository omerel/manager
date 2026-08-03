## Why

The system reads dates the American way, and does it silently. Measured:

```
03/08/2026  →  2026-03-07      3 באוגוסט became 7 במרץ
3.8.2026    →  2026-03-07
03-08-2026  →  2026-03-07
2026-08-03  →  2026-08-03      only ISO survives
```

Every parse goes through `new Date(string)`, which applies the US month-first rule and then shifts by the local timezone — so an Israeli-written date lands five months and a day away, as a perfectly plausible date that nobody will question. Document extraction is the live exposure: the agent is asked for `YYYY-MM-DD`, but it reads Israeli documents, and the day it returns what a document actually says, the wrong date is stored and approved without a hint that anything happened.

Date entry is exposed differently. The value a native `<input type="date">` submits is always ISO, so storage is safe today — but what the field *displays* follows the browser's locale, so a machine set to US English shows and accepts `mm/dd/yyyy` on screen. That is precisely the confusion this change is meant to end.

## What Changes

- **One date module owns parsing and formatting.** A strict parser accepts `dd/mm/yyyy` (with `/`, `.` or `-` separators) and unambiguous ISO `yyyy-mm-dd`, and **nothing else**. It never applies the month-first reading — not as a fallback, not for `03/08` where both readings are numerically possible. `new Date(<user or agent string>)` disappears from the codebase.
- **Date fields become strict `dd/mm/yyyy` text inputs** (the user's decision), so the format is the same on every browser and machine rather than whatever the operating system's locale dictates. This costs the native date picker; the field validates as you type and states the format.
- **Dates the user writes or reads in a form or an export are `dd/mm/yyyy`.** The long Hebrew reading form ("3 באוגוסט 2026") **stays** on cards, lists and gap rows (the user's decision): it is easier to read and cannot be misread in either direction.
- **Extraction accepts Israeli dates.** The agent is told the documents are Israeli and that `dd/mm/yyyy` is what it will see; whatever it returns is parsed by the same strict parser. A date it cannot parse is **rejected rather than guessed** — the field is simply not proposed, and the reviewer fills it in by hand.
- **Custom card fields of type DATE** follow the same rules, in the form and in display.
- **No data migration.** DATE custom-field values are free strings that could be in any shape, so a normalisation pass looked necessary — measured, the registry has **zero DATE field definitions and zero such values**, so there is nothing to convert. The strict rules apply to everything written from here on; a backfill would be ceremony over an empty table.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `people-registry`: dates are entered and validated in one Israeli format; the card schema's DATE fields follow it.
- `data-ingestion`: an extracted date is read as an Israeli date, and an unparseable one is refused rather than guessed.

## Impact

- `src/lib/dates.ts` — `parseIsraeliDate` / `formatIsraeliDate`; `fmtDate` (long form) stays.
- **Every parse site**: `person-actions.ts` (`dateOrNull`), `extract-actions.ts` (`applyItem`), `person-schema.ts` (`formatFieldValue`), `people/new/page.tsx` (`draftDate`).
- **Every input**: a new `DateField` component replacing six `type="date"` inputs (`PersonFormFields.tsx` ×4, the person card's progress and reading forms ×2) plus the DATE branch of the custom-field renderer.
- `src/lib/agent.ts` — the extraction prompt states the document convention.
- `src/lib/portability.ts` and `agent-snapshot.ts` keep ISO: they are machine interfaces, and ISO is the unambiguous form. Not changed.
- **Not changed**: storage (Postgres `timestamp`, always unambiguous), the years.months plan notation, the long display format.
