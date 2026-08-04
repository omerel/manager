## 1. The script and its interpreter

- [x] 1.1 `docker/emailer.py` — accepts `--title`, `--body`, `--to`; prints what it received so the contract is checkable; exits **201** on success and a non-201 code otherwise. Random by default (as requested); `EMAILER_FORCE=sent|failed` pins the outcome so verification can assert both paths instead of depending on a coin flip.
- [x] 1.2 Header comment in that file: the target environment **replaces** it, and the three flags plus the 201 convention are the part that must not change. Without this a reader finds a random-number generator in the delivery path and cannot tell whether it is a bug.
- [x] 1.3 `Dockerfile`: `python3` in the runtime stage's apt line. It is absent today — the feature works in development and fails with ENOENT in the delivered image, which is the failure this task exists to prevent.

## 2. The transport

- [x] 2.1 `src/lib/emailer.ts` — `sendReport({ title, body, to })` spawning `python3 docker/emailer.py` via `execFile` with a timeout, following the pattern in `doc-text.ts`. Returns `{ ok: true } | { ok: false; reason: string }` and **never throws**.
- [x] 2.2 Guard the argument-length limit before spawning, in **bytes** (`Buffer.byteLength`), not characters: Linux caps a single argument at 131,071 bytes (measured), and Hebrew is 2 bytes per character — a `.length` check would pass a 70,000-character Hebrew report that occupies 140,000 bytes and then dies with `E2BIG`. Over the limit → a failed send with a reason naming the size, not an opaque spawn error.
- [x] 2.3 Map every non-201 outcome — wrong exit code, script missing, interpreter missing, timeout — to a Hebrew reason an operator can act on.

## 3. The questions page

- [x] 3.1 `chat-actions.ts`: `emailRun(prevState, formData)` — owner-only (the same check the download route makes), resolves title exactly as the download route does (`run.rule?.name ?? "תשובה"` + date) and body from `run.output`, sends to `me.email`, returns state.
- [x] 3.2 Questions page: a "שלח למייל" control beside `⬇ MD` / `⬇ PDF`, using `useActionState` so the result appears next to the button that was pressed. Locked while in flight (`SubmitButton`).

## 4. Rules

- [x] 4.1 Schema: `Rule.emailOnRun Boolean @default(false)`; additive migration, no backfill, so every existing rule stays silent.
- [x] 4.2 `rules-actions.ts`: `createRule` reads the toggle; the existing schedule-editing path also edits it, so both live in the same place the owner already goes.
- [x] 4.3 Rules pages: the toggle on the create form and on the rule's own page, labelled so it is clear the mail goes to the owner.
- [x] 4.4 `rules-engine.ts` `executeRuleJob`: on success, re-read `emailOnRun` and if set send the output to the rule's owner. Append the outcome to the run record so a failure is visible on the rules page — a scheduled send that failed silently would be worse than not sending at all.

## 5. Verification

- [x] 5.1 The script honours its contract: invoked with the three flags it echoes them back; `EMAILER_FORCE=sent` exits 201 and `=failed` does not.
- [x] 5.2 `sendReport` maps outcomes correctly — forced success → `ok`, forced failure → `!ok` with a reason, missing script → `!ok`, oversized body → `!ok` with the length reason. Assert it never throws.
- [x] 5.2b The byte-vs-character trap specifically: a Hebrew body of ~70,000 characters (~140,000 bytes) is refused, and one of ~60,000 characters (~120,000 bytes) is accepted — a character-based check would get this backwards.
- [x] 5.3 Browser: send an answer from the questions page with `EMAILER_FORCE=sent` and see the confirmation; with `=failed` see the failure beside the control. Assert the body handed to the script byte-matches what `⬇ MD` serves.
- [x] 5.4 A rule with the toggle on: run it forced-failed and assert the failure is recorded on the run and visible on the rules page; run it forced-sent and assert the owner's address was the destination.
- [x] 5.5 A rule with the toggle off sends nothing.
- [x] 5.6 `python3` is present in the built image — or, if docker is unavailable here, assert the Dockerfile's runtime stage installs it and say plainly that the image build was not exercised.
- [x] 5.7 Delete throwaway scripts; keep the reusable verification alongside the existing `verify-*` ones. (verify-emailer.ts kept; the page and rule checks were run inline against the dev server)
