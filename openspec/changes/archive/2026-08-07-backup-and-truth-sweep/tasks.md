## 1. Backup covers queries and the activity log

- [x] 1.1 `portability.ts`: dump `query`, `queryTarget`, `activityLog`
- [x] 1.2 Wipe order: `queryTarget` → `query` before their parents; `activityLog` has no FKs and goes anywhere
- [x] 1.3 Restore order: after `orgNode` and `user` — `query`, then `queryTarget`, then `activityLog`
- [x] 1.4 Verify an old bundle (without the new keys) still restores — missing keys read as empty arrays

## 2. The three verification suites

- [x] 2.1 `verify-placement-anchor`: deterministic subject with guards — no `endOfServiceDate`, no waiver overrides, and the axis-comparison block asserts its veteran precondition so an unsuitable fixture fails as "fixture unsuitable", not as an engine accusation
- [x] 2.2 Intake action-link label exported once beside the intake code; `IntakeSection` and `verify-intake` both import it
- [x] 2.3 End-of-service form label composed around the canonical `person-schema.ts` string, so the card-schema containment check passes by construction
- [x] 2.4 All 21 suites green

## 3. Documentation back to the truth

- [x] 3.1 README: delete "Not yet built"; rewrite "What the app shows" to cover plans, gaps, agent, queries, activity log, email and intake; refresh the handy-scripts list
- [x] 3.2 Dist guide (`build-dist.sh` heredoc): document the email contract — `emailer.py` is a stand-in the target replaces; three flags; verdict is the last non-empty stdout line, not the exit code
- [x] 3.3 Move `fix pahse` from the repo root into the archive of the change it produced

## 4. Lint to zero

- [x] 4.1 The three pages compute `now` once per request and thread it, as `computePersonGaps` already does
- [x] 4.2 Remove the three unused symbols (`assignPlan` import, `canReceive`, `_kind`)
- [x] 4.3 `eslint src --max-warnings=0` passes

## 5. Verification

- [x] 5.1 Round trip on live data: counts of queries, query targets (answered and not), and activity entries identical after restore
- [x] 5.2 The cascade path specifically: restore a bundle, confirm queries survived the `orgNode` wipe-and-recreate
- [x] 5.3 tsc, build, lint all clean
- [x] 5.4 `openspec validate --specs` passes after sync
