## Context

Both report kinds are already the same object: an `AgentRun` with `output` holding markdown. The download route resolves a title from `run.rule?.name ?? "תשובה"` plus the run date, and the same run feeds the questions page and the rules page. So "email this report" needs no new content pipeline — only a transport and a place to put the button.

Two facts shape the design:

- **`python3` is not in the runtime image.** The Dockerfile installs poppler, tesseract and node; a Python script would run in development (where python3 exists) and fail with ENOENT in the delivered image. Nothing would notice until a user pressed the button in production.
- **The rules page is private by design.** A rule and its runs are visible only to their owner, explicitly including the Admin. Any email destination other than the owner would put a private report somewhere the privacy model never authorised.

The project already spawns external binaries twice — the Claude CLI in `agent.ts` and poppler/tesseract in `doc-text.ts` — both through `execFile` with a timeout and a failure message an operator can act on. That is the pattern to follow rather than invent.

## Goals / Non-Goals

**Goals:**

- Send the exact markdown the download button produces, to the signed-in user's own address.
- A rule can mail its output to its owner on every run, scheduled or manual.
- A send that fails says so, in the interface, at the moment it fails.
- The stand-in script is honest about being a stand-in, and exercises both outcomes.

**Non-Goals:**

- Implementing real mail delivery. The target environment owns that; `emailer.py` is replaced after the image is built.
- Attachments, PDF by mail, HTML bodies, templates. Title and markdown body, as specified.
- Sending to anyone but the signed-in user or the rule's owner.
- A queue or retry. One attempt, and the result is reported.

## Decisions

### 1. `emailer.py` is a contract, and the shipped file is a stand-in that says so

```
python3 docker/emailer.py --title "<report title>" --body "<markdown>" --to "<address>"
```

Success is **201**; anything else is a failure. The stand-in exits with 201 or with a non-201 code and prints what it received, so the contract can be checked without a mail server.

The header comment states plainly that this file is expected to be overwritten in the target environment, and that its interface — the three flags and the 201 convention — is the part that must not change. Without that note, the next person to read it sees a random-number generator in the delivery path and has to guess whether it is a joke or a bug.

**The body is passed as an argument**, not on stdin, because the request specified `--body`. That puts a hard ceiling on it, measured on this machine:

```
ARG_MAX (all argv + envp)      2,097,152 bytes   ← not the binding limit
largest single argument          131,071 bytes   ← 128KB, found by bisection
                                 131,072 → E2BIG
```

Linux caps one argument at `MAX_ARG_STRLEN` (32 pages), sixteen times below `ARG_MAX` — so checking `getconf ARG_MAX` and concluding there is room to spare is the easy mistake here.

The check must count **bytes, not characters**. Hebrew is two bytes per character in UTF-8, so `"א".repeat(70000)` has `.length === 70000` and occupies 140,000 bytes: a length check would wave through a report that then dies with `E2BIG`. In characters the ceiling is ~65,500 Hebrew, ~131,000 ASCII, ~81,900 for mixed markdown.

For scale: the largest output this system has ever produced is 2,049 bytes — 1.6% of the limit. The guard is a net for an unusual report, not a routine constraint.

### 2. Random by default, deterministic when asked

The request asked for a random outcome so both paths get exercised. That is right for hand-testing and useless for an automated suite, which cannot assert against a coin flip.

So: random by default, and `EMAILER_FORCE=sent|failed` pins the outcome. Verification sets it and asserts both branches — the success path reaches the user as "נשלח", the failure path as an error the user sees. Nothing about the default behaviour changes.

### 3. Failure is surfaced, never swallowed

`sendReport()` returns `{ ok: true } | { ok: false; reason: string }` and never throws. The two callers differ in where the answer goes:

- **The questions page** is interactive: the action returns state and the page shows "נשלח למייל" or the failure, beside the button that was pressed.
- **A rule run** may happen on a schedule with nobody watching. Its outcome is appended to the run record, so the failure is visible on the rules page the next time the owner looks — the same place they already go to read the output. A scheduled send that fails silently would be worse than not sending at all, because the owner would believe a report went out.

### 4. `Rule.emailOnRun`, and the run reads it at execution time

A boolean on `Rule`, default false, editable wherever the schedule is editable. `executeRuleJob` reads it when the run finishes and, if set, mails the output to the rule's owner.

Reading it at execution rather than capturing it when the run starts means turning the toggle off stops the next email even for a run already in flight — which is what someone switching it off expects.

### 5. `python3` joins the runtime image

One package in the existing `apt-get` line. Worth stating why it is part of *this* change: the feature is not shippable without it, and the failure it prevents is invisible in development — exactly the class of defect that reaches the air-gapped environment and is discovered there.

## Risks / Trade-offs

- **The target environment's script behaves differently from the stand-in** → the contract is narrow on purpose (three flags, 201) and documented in the file itself; verification asserts the caller's behaviour for both outcomes, so a replacement honouring the contract needs no code change here.
- **A very long report exceeds the argument limit** → detected and reported as a failed send with a specific reason, rather than an opaque spawn error.
- **A scheduled send failing while nobody watches** → recorded on the run and shown on the rules page; the owner learns at the moment they would have gone looking for the report anyway.
- **The user's address is wrong or absent** → `User.email` is required and unique, so it exists; a bad address is the mail system's error to report, and it arrives as a non-201.

## Migration Plan

One additive migration for `Rule.emailOnRun` (default false, so every existing rule keeps its current silent behaviour). No backfill. Rollback is reverting the commit.

## Open Questions

None. The destination for a scheduled rule's email — the owner only — was settled with the user before this document.
