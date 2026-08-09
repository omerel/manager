## 1. The script

- [x] 1.1 Add `--from` (optional, default `"?"`) and append one line per invocation — time, verdict, sender, recipient, subject — to `EMAILER_LOG`, defaulting to `mail.log` beside the script
- [x] 1.2 Wrap the log write so an unwritable path warns and proceeds to the verdict — the aid must not become the fault
- [x] 1.3 Update the contract comment at the top of the file: the fourth flag is additive and ignorable, the log is the stand-in's own and not the replacement's duty

## 2. The callers

- [x] 2.1 Make `from` a required field of `sendReport`, passed to the script as `--from` — required, so the compiler surfaces every call site including any the last three commits added
- [x] 2.2 Pass the rule's owner in the chronic run, the signed-in asker on the questions page, and the acting user in every query mail path — read the current code first; queries gained senders and lateral paths since I last saw them

## 3. Verification

- [x] 3.1 Point `verify-emailer.ts`'s existing calls at the new signature, and add log checks against the real script with a scratch `EMAILER_LOG`: a send appends one line carrying all five facts, a forced failure logs as נכשל, N sends append exactly N lines, and an unwritable path still yields a verdict
- [x] 3.2 Confirm the `withScript` throwaway replacements — which never log — still pass, proving the log is not accidentally part of the contract
- [x] 3.3 Run the suite twice, `npx tsc --noEmit`, `npm run build`, and re-run the query e2e suite since its mails now carry senders
