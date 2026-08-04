## Why

Testing the feature surfaced two things that only show up once mail actually goes out.

**The subject is filler.** It is assembled as `<rule name or "תשובה"> · <date>` — so every answer from the questions page arrives as "תשובה · 2026-08-04", and an inbox of them is indistinguishable. Meanwhile the report already opens with its own heading (`# אנשים במרכז המחקר`), which is exactly the sentence a subject line wants.

**The success signal is an HTTP status pretending to be an exit code.** 201 was chosen when the real script was imagined as an HTTP client, and it carries a hazard already documented in the file: exit codes are masked to 8 bits, so an unrelated 457 arrives as exactly 201 and reads as sent. A plain boolean is what the caller actually needs.

## What Changes

- **The subject becomes the report's own first line.** The first non-empty line, with markdown heading markers and emphasis stripped, capped to a sane subject length. When that line yields nothing usable, the subject falls back to today's title — the rule's name, or "תשובה" (the user's decision), so a mail is never sent with an empty subject.
- **The result is `1` or `0` printed on stdout** (the user's decision), replacing exit code 201. Success is `1`, failure is `0`.
- **BREAKING for `emailer.py`'s contract.** The interface the target environment must honour changes: print `1` or `0` as the last line of stdout, and exit 0 normally. The header comment is rewritten to say exactly that.
- **The exit code stops being the verdict** and becomes what it conventionally is — a signal that the script ran. A script that crashes prints no `1`, so it reads as a failure whatever its exit code. This is why the signal moved to stdout rather than becoming "exit 1 = success": measured, an unhandled Python exception and a syntax error both exit **1**, so making 1 mean success would read every crash of the real script as a delivered mail.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `email-delivery`: what the script returns and how the caller reads it; what the subject of a sent report is.

## Impact

- `web/docker/emailer.py` — prints `1`/`0`, exits 0; the 201 convention and its 8-bit warning are replaced by the new contract, still marked as a stand-in the target environment replaces.
- `web/src/lib/emailer.ts` — reads the boolean from stdout rather than the exit code; a script that exits non-zero, prints nothing, prints something unparseable, or times out is a failure with a reason.
- **New** subject derivation, shared by both callers so an emailed answer and an emailed rule report cannot title themselves differently.
- `web/src/lib/chat-actions.ts` and `web/src/lib/rules-engine.ts` — both stop building the subject and ask for it.
- `web/scripts/verify-emailer.ts` — the contract assertions change with the contract.
- **Not changed**: who receives a report, how failures surface to the user, the argument-length guard, `python3` in the image.
