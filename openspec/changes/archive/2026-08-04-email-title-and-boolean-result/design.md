## Context

`sendReport({title, body, to})` spawns `python3 docker/emailer.py --title … --body … --to …` and today reads the **exit code**, treating 201 as sent. Two callers build the title themselves:

```ts
chat-actions.ts   `${run.rule?.name ?? "תשובה"} · ${run.createdAt…}`
rules-engine.ts   `${rule.name} · ${new Date()…}`
```

What the reports actually open with, sampled from the runs in this database:

```
# אנשים במרכז המחקר          ← markdown H1
## כמה אנשים עם פערים?        ← H2
**נכון לתאריך: 2026-08-02**   ← bold, not a heading
הנתונים נקראו. להלן הדוח.     ← plain prose
```

So "the first line" is usually a heading and sometimes not, and the markers have to come off either way.

On the result signal, the relevant fact is measured rather than assumed:

```
unhandled exception  → exit 1
syntax error         → exit 1
script missing       → exit 2
killed / timed out   → exit 124
```

`1` is the single most likely accidental exit code from a Python script. That rules out "exit 1 means sent" — it would read every crash of the real implementation as a delivered mail, which is the precise failure this system has been avoiding everywhere else.

## Goals / Non-Goals

**Goals:**

- A subject a person recognises in an inbox, taken from the report itself.
- A boolean result, in a place where a crashing script cannot accidentally produce the success value.
- The contract the target environment must honour stated plainly in the file it will replace.

**Non-Goals:**

- Choosing a "best" line by scanning for a heading further down. The request was the first line; second-guessing it would make the subject unpredictable.
- Localising or templating subjects.
- Changing recipients, failure surfacing, or the argument-length guard.

## Decisions

### 1. The boolean lives on stdout; the exit code goes back to meaning "it ran"

The script prints `1` (sent) or `0` (failed) as the last non-empty line of stdout and exits 0.

The caller requires **both**: a zero exit *and* a parsed `1`. That combination is what makes the signal safe — the failure modes above produce no `1` on stdout, so a crash, a missing file, a timeout or a stack trace all read as failure without the caller needing to enumerate them.

*Alternative considered — exit 1 = sent, 0 = failed, as the literal reading of "1 or 0".* Rejected on the measurement above: an unhandled exception exits 1, so the most common way for the real script to break would report success. Nothing else in the design can compensate for that.

*Alternative considered — Unix convention, exit 0 = sent.* Safe, and it was offered; the user chose stdout. It also has a real drawback here: exit 0 is what a script produces by falling off the end without doing anything, so "did nothing" and "sent" would be the same value.

**Reading the last non-empty line, not the whole output**, so a script that logs before its verdict still works — the real implementation will print diagnostics, and the contract should not forbid that.

### 2. The subject is the first line, cleaned, with a fallback

`subjectFromReport(body, fallback)`:

1. first non-empty line
2. strip leading `#`s, and surrounding `**`/`*`/`_` emphasis
3. collapse whitespace, cap at a subject-sane length (~120 chars, cutting on a word boundary)
4. if nothing is left, return the fallback

The fallback stays what the subject is today — the rule's name, or "תשובה" (the user's decision) — so a report can never go out with an empty subject.

It lives in one module because both callers need identical behaviour: an answer emailed from the questions page and a rule report emailed on a schedule must not title themselves by different rules.

**A known and accepted limitation:** for the sampled report whose first line is `**נכון לתאריך: 2026-08-02**`, the subject becomes "נכון לתאריך: 2026-08-02" — faithful to "the first line", and not a good subject. Scanning for a heading instead would fix that case and make the subject unpredictable in others. The request was explicit, so the rule stays explicit, and this is written down rather than discovered later.

### 3. The stand-in file is rewritten around the new contract

The header currently documents 201 and warns about 8-bit masking. Both go, replaced by: print `1` or `0` as the last line, exit 0, and the note that this file is a stand-in the target environment replaces. Leaving the old warning would describe a convention the code no longer uses — worse than no comment.

`EMAILER_FORCE=sent|failed` stays: a verification suite still cannot assert against a coin flip.

## Risks / Trade-offs

- **A replacement script prints extra output after its verdict** → the caller reads the *last* non-empty line, so trailing logs would break it. The contract says "last line" explicitly and verification asserts a script that logs *before* its verdict works.
- **A replacement script forgets to print anything** → reads as failure. The safe direction: the user is told the mail did not go out when its status is unknown.
- **The subject is only as good as the report's first line** → stated above, with the sampled counter-example.
- **A very long first line** → capped on a word boundary; a subject is not a place to dump a paragraph.

## Migration Plan

None — no schema change and nothing stored. Both changes are to code and to a file the target environment replaces. Rollback is reverting the commit.

## Open Questions

None. Where the boolean lives, and what happens when the first line is unusable, were settled with the user before this document.
