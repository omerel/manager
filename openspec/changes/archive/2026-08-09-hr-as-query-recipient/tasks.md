## 1. Data model

- [x] 1.1 `QueryTarget`: `nodeId` becomes optional, `targetUserId` added with `onDelete: Cascade` and a `(queryId, targetUserId)` unique; migration via `migrate diff`, read before applying
- [x] 1.2 Prove against the database: exactly-one-endpoint rows coexist, two HR targets on one query are allowed, deleting the user removes their row and leaves the query with its framework targets, and every existing row is untouched

## 2. The rules

- [x] 2.1 `eligibleHr(senderNodeId)` — HR users whose grants give `canEdit` over the framework, through `visibilityFrom`, so inheritance from an ancestor grant comes free and stays consistent with every other coverage question
- [x] 2.2 `canSendFrom` keeps answering the framework question; a new `maySendToHr` is simply "commands anything" — the team-level unlock
- [x] 2.3 Extend `mayRead`/`mayAnswer` with the person-target branch: the row belongs to `targetUserId`, nobody else
- [x] 2.4 The badge counts person-targets awaiting the HR user

## 3. The action

- [x] 3.1 `createQuery` accepts HR recipients alongside framework ones, validates eligibility server-side (edit coverage, HR role), and writes person-target rows
- [x] 3.2 `answerQuery` resolves a person-target by user id, not by commanded framework
- [x] 3.3 Mail and reminders to a person-target go to the person's own address; the answer notice back to the asker is unchanged
- [x] 3.4 Sweep every reader of `target.nodeId` for the now-optional value — the compiler will list them

## 4. The page

- [x] 4.1 The recipient picker gains an HR section listing the eligible users by name; the team commander's form shows it alone, with the empty-state explanation
- [x] 4.2 The HR user's page gains the for-me panel — both panels, fold, search, side chooser, all as a commander has them
- [x] 4.3 The sender's row for a person-target names the person, and marks lapsed coverage rather than repairing it

## 5. Verification

- [x] 5.1 Rules suite: eligibility (edit qualifies, view refused, MANAGER refused, inheritance qualifies), the team-level unlock, person-target read/answer ownership, badge counting, and the lapsed-grant row surviving
- [x] 5.2 E2E: a team commander sends to their HR through the real form, the HR user sees it in for-me, answers as themselves, the sender reads it; a mixed framework+person query tallies all rows; sibling separation between a framework target and a person target
- [x] 5.3 The existing suites stay green on framework targets. Exactly two lateral-section checks flipped (one panel / no side chooser), both direct assertions of the requirement this change REMOVES; nothing else was edited
- [x] 5.4 Both suites twice, `npx tsc --noEmit`, `npm run build`
