## Why

A report the system produces can be downloaded, and that is all. To send one to someone — or to keep it after the browser tab closes — the user has to save a file and attach it by hand. A rule that runs on a schedule is worse: it produces its output into a page nobody is looking at, so a weekly report only exists if someone remembers to go and read it.

## What Changes

- **The questions page gains "שלח למייל"** beside its download buttons: the same markdown that `⬇ MD` produces, sent to the signed-in user's own address.
- **A rule carries a "send by email when it runs" toggle**, set when the rule is created and editable afterwards. When the rule runs — on its schedule or on demand — its output is mailed to **the rule's owner only**, which is the only address consistent with a rules page that is private even from the Admin.
- **Sending goes through `emailer.py`**, invoked with `--title`, `--body` and `--to`. Anything other than exit/HTTP **201** is a failure, and a failure is **shown to the user**, never swallowed.
- **The shipped `emailer.py` is a stand-in.** The real one belongs to the target environment and will replace this file after the image is built. Ours prints exactly what it was handed — so the contract can be verified — and returns success or failure so both paths are exercised. It is random by default, as requested, with an environment variable to force either outcome, because a verification suite cannot assert against a coin flip.
- **`python3` is added to the runtime image.** It is not there today: `emailer.py` would fail with "command not found" in production while working perfectly in development.

## Capabilities

### New Capabilities

- `email-delivery`: sending a produced report to a user's address, and how a failure surfaces.

### Modified Capabilities

- `agent-qa-chat`: an answer can be sent to the asker's address, not only downloaded.
- `agent-rules-engine`: a rule can carry an email-on-run flag, and a scheduled run reaches its owner.

## Impact

- **New** `docker/emailer.py` — the stand-in, with its parameter contract documented at the top and a note that the target environment replaces it.
- **New** `src/lib/emailer.ts` — spawns the script (the `execFile` pattern `doc-text.ts` already uses), maps the result to sent/failed, never throws into a page.
- `Dockerfile` — `python3` in the runtime stage; `docker/` is already copied.
- `prisma/schema.prisma` — `Rule.emailOnRun Boolean @default(false)`. One additive migration.
- `src/lib/chat-actions.ts` and the questions page — the send action and its result message.
- `src/lib/rules-actions.ts`, `src/lib/rules-engine.ts` and the rules pages — the toggle, and the send after a successful run.
- The markdown and title come from the same place the download route uses, so an emailed report and a downloaded one cannot differ.
- **Not changed**: PDF export, the agent, how runs are stored.
