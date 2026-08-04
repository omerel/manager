## 1. The script's contract

- [x] 1.1 `docker/emailer.py` prints `1` (sent) or `0` (failed) as its **last non-empty line** and exits 0. `EMAILER_FORCE=sent|failed` still pins it; random stays the default.
- [x] 1.2 Rewrite the header comment around the new contract, and **remove** the 201 convention and its 8-bit-masking warning — a comment describing a convention the code no longer uses is worse than none. Keep the statement that the target environment replaces this file.
- [x] 1.3 Have the stand-in print a diagnostic line *before* its verdict, so the "last line wins" rule is exercised by the shipped file rather than only by a test fixture.

## 2. Reading the result

- [x] 2.1 `src/lib/emailer.ts` reads the verdict from stdout: success requires **both** a normal exit **and** a last non-empty line of exactly `1`. Record in a comment why the exit code is no longer the verdict — measured, an unhandled Python exception and a syntax error both exit 1.
- [x] 2.2 Every other outcome maps to a failure with a Hebrew reason: printed `0`, printed something else, printed nothing, non-zero exit, interpreter or script missing, timeout.

## 3. The subject

- [x] 3.1 New `src/lib/report-subject.ts` — `subjectFromReport(body, fallback)`: first non-empty line → strip leading `#`s and surrounding `**`/`*`/`_` → collapse whitespace → cap ~120 chars on a word boundary → fall back when empty. One module, because both callers must title reports identically.
- [x] 3.2 `chat-actions.ts` `emailRun` uses it, falling back to today's title (`rule.name ?? "תשובה"`).
- [x] 3.3 `rules-engine.ts` `mailIfAsked` uses it, falling back to the rule's name.

## 4. Verification

- [x] 4.1 Subject derivation, as a table over the shapes that actually occur in this database: `# אנשים במרכז המחקר` → "אנשים במרכז המחקר"; `## כמה אנשים עם פערים?` → without the markers; `**נכון לתאריך: 2026-08-02**` → emphasis stripped; plain prose unchanged; empty body → the fallback; a 400-character line → capped.
- [x] 4.2 The result contract: forced sent → `ok`; forced failed → not ok; **a script that prints `1` after log lines → ok** (the "last line wins" rule).
- [x] 4.3 **The crash cases, which are the point of moving the signal**: a script that raises (exit 1), one that is missing, and one that prints nothing must all read as failure. Assert explicitly that exit code 1 does NOT read as success.
- [x] 4.4 A last line that is neither `1` nor `0` reads as failure, not as a guess.
- [x] 4.5 Browser: send an answer whose body starts with a heading, and assert the subject handed to the script is that heading — read from what the script echoes, not from the calling code.
- [x] 4.6 A rule report emailed on a run gets the same treatment.
- [x] 4.7 Update `verify-emailer.ts` to the new contract and delete the assertions that pinned 201; keep it runnable alongside the other `verify-*` scripts.
