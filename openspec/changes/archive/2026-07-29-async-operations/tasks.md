## 1. Job infrastructure

- [x] 1.1 Extend AgentRun: kind values (CHAT/RULE/PIN/EXTRACT) + optional personId (additive migration)
- [x] 1.2 `runInBackground` helper: create RUNNING job → `after()` executes → job updated on success/failure
- [x] 1.3 Duplicate-run guard: refuse a new job while one is RUNNING for the same rule / person / user-new-extraction
- [x] 1.4 Stale-job hygiene: RUNNING older than the engine timeout reads as FAILED ("הריצה נקטעה")
- [x] 1.5 `AutoRefresh` client component (router.refresh interval, self-stopping, capped)

## 2. Convert chat

- [x] 2.1 askQuestion returns immediately (job + redirect to ?run=)
- [x] 2.2 Chat page: "הסוכן חושב…" progress card + AutoRefresh while RUNNING; answer/error renders in place

## 3. Convert rules (run + pin)

- [x] 3.1 runRuleNow returns immediately; rule page shows the running entry live
- [x] 3.2 Pin becomes a PIN job: immediate return, "מקבע…" state on the rule page, flips to pinned panel when stored
- [x] 3.3 Disable run/pin buttons + show notice while a job is RUNNING for the rule

## 4. Convert extraction

- [x] 4.1 Person-edit extraction: immediate return; panel shows "מנתח…" until proposals appear (or empty-result notice)
- [x] 4.2 New-person extraction: immediate return; page picks up the finished draft (run.output → draft id) and pre-fills
- [x] 4.3 Guard duplicate extraction per person / per user

## 5. Verification

- [x] 5.1 Browser-test: immediate response on all four operations; results auto-appear without manual reload
- [x] 5.2 Test duplicate-run guard and stale-job failure rendering
- [x] 5.3 Test navigate-away-and-return shows the finished result
