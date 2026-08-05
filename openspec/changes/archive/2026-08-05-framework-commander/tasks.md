## 1. Data model

- [x] 1.1 Add `commandsNodeId String? @unique` and the `commandsNode` relation to `User`, with the matching back-relation on `OrgNode` and `onDelete: SetNull`
- [x] 1.2 Generate the migration with `--create-only` and read the SQL before applying: column, unique index, FK with `ON DELETE SET NULL`
- [x] 1.3 Apply it and prove the three properties against the database — many users may hold NULL, a second commander for one framework is rejected by the index, and deleting a framework nulls the pointer while leaving the user, their grants and their rules intact

## 2. The condition: command requires access

- [x] 2.1 Write a single `assertCanCommand(userId, nodeId)` helper reading `computeVisibility`, accepting any level and any node within a granted subtree, and returning the Hebrew refusal naming the framework — one definition, so the four call sites cannot drift apart
- [x] 2.2 Enforce it in `updateUserProfile` when the command changes
- [x] 2.3 Confirm there is no role-change path in the system (role is set at creation and never edited), so an Admin cannot lose sight of the framework they command; record it in the code rather than guarding an input that cannot arrive
- [x] 2.4 Refuse in `removeGrant` while the user commands a framework inside that grant's subtree, naming it; allow the removal when another grant still covers it

## 3. Server actions

- [x] 3.1 Add an optional first grant (`grantNodeId` + `grantLevel`) to `createUser`, created in the same transaction as the user
- [x] 3.2 Add `commandsNodeId` to `createUser`, empty as null, validated against the first grant's subtree (or accepted outright for an ADMIN)
- [x] 3.3 Add `commandsNodeId` to `updateUserProfile`, supporting set, change and clear
- [x] 3.4 Refuse a taken framework before writing, with a message naming the current commander and the path to removal; translate the unique-violation (`P2002`) on that column to the identical message so the race path and the ordinary path read the same
- [x] 3.5 Log `user.command.set` / `user.command.clear` to the activity log, naming the user and the framework

## 4. Interface

- [x] 4.1 Build the framework options list with full paths (`מרכז ▸ תחום ▸ מדור`), covering all four kinds, sorted in Hebrew
- [x] 4.2 Add the first-grant chooser (framework + level) to the create-user form, both optional
- [x] 4.3 Add the command chooser to the create-user form, with an explicit empty option, and a note that it must fall within the granted access
- [x] 4.4 Add the command chooser to the per-user edit form, listing only frameworks that user can already see, plus the current one
- [x] 4.5 Show the commanded framework on the user's row, and mark a commander whose access no longer covers it — the state a framework move can still produce
- [x] 4.6 Show the commander's name beside each framework in the hierarchy tree

## 5. Guarding the decision

- [x] 5.1 Keep visibility a single definition — `computeVisibility` refactored to a thin wrapper over a pure `visibilityFrom`, so the page and the action cannot drift — and comment the two halves at the point of enforcement: command is a precondition on access, never a source of it
- [x] 5.2 Write `scripts/verify-framework-commander.ts` (rules, 38 checks) and `scripts/verify-framework-commander-e2e.ts` (the actions through the real forms, 17 checks) covering: empty accepted; a second commander refused by name with nothing changed; clear-then-assign succeeds; appointment without access refused and no grant created; a grant on an ancestor qualifies; view level qualifies; appointment creates and removes no grant (`computeVisibility` byte-identical before and after); removing the covering grant refused by name; removing an unrelated grant allowed; demoting a commanding admin refused; deleting the framework releases the command and keeps the user
- [x] 5.3 Run the suite, and run it twice in a row to prove it is idempotent
- [x] 5.4 `npx tsc --noEmit` and `npm run build`
