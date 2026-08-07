## 1. The role

- [x] 1.1 `Role` gains `HR`; migration only, no user changes role
- [x] 1.2 `src/lib/role-labels.ts` — a client-safe `ROLE_LABEL` map; replace the `ADMIN ? "אדמין" : "מנהל"` ternary in `Header.tsx`, `access/page.tsx`, `account/page.tsx` and `access-actions.ts`, all four of which would silently label HR as "מנהל"
- [x] 1.3 The role chooser on `/access` offers משא״ן; `createUser` accepts it instead of coercing everything that is not ADMIN to MANAGER
- [x] 1.4 HR is operational, not configurational: no change to `requireAdmin` or to any guard that uses it — verified rather than assumed
- [x] 1.5 No change to `requireEstablishForNode`. HR enrols and removes only from a section-level grant, like anyone else

## 2. One definition of who owns a query

- [x] 2.1 `Query.senderKind: FRAMEWORK | STAFF`, defaulting to `FRAMEWORK` so every existing row keeps its meaning with no backfill; `senderNodeId` stays required and its comment records that for a STAFF query it is the scope the request was made under, never the sender
- [x] 2.2 `isSenderOf(user, query)` in `queries.ts` — the framework branch and the author branch, one place
- [x] 2.3 Replace all eight `query.senderNodeId !== me.commandsNodeId` checks in `query-actions.ts` with it; none may remain, because the eighth is the one that drifts
- [x] 2.4 `mayRead` gains the same branch on its sender side; its recipient side is untouched
- [x] 2.5 The page's "sent" list becomes the same rule as a query filter, not a second expression of it

## 3. Sending laterally

- [x] 3.1 `lateralRecipients(visibility)` — every commanded framework inside the granted subtrees, at any depth, granted node included, uncommanded frameworks omitted; several grants union into one list
- [x] 3.2 `validRecipient` gains the lateral case, and the action validates every recipient against it server-side whatever the form offered
- [x] 3.3 `createQuery` accepts an HR sender: `senderKind: STAFF`, `authorId` the user, `senderNodeId` the granted node the recipients fell under. Refuse an empty recipient list as today
- [x] 3.4 No pre-selection for an HR sender, and a select-all instead; no `@` picker at all — the reach is the subtree and nothing beyond it
- [x] 3.5 `canSendFrom`'s refusal of teams stays exactly as it is: it is about sending from a team, and never applied to being addressed

## 4. What each side sees

- [x] 4.1 One from-line helper, branching on `senderKind`: a framework path, or `משא״ן · <name>`. Used by the recipient's card and by the notification mail body, so the two cannot say different things
- [x] 4.2 The HR page is one panel — the queries they sent — with no for-me panel and no side chooser; absent, not empty
- [x] 4.3 The header's queries link follows "has a correspondent identity" (commands a framework, or is HR with a grant) rather than `commandsNodeId` alone; the badge counts only what an HR user actually has, which is new answers
- [x] 4.4 An HR user with no grant is refused the page with the same explanation a commander-less Manager gets

## 5. Deleting the user

- [x] 5.1 `deleteUser` closes every open query the user sent as a person — `closedAt` set — before the user row goes
- [x] 5.2 Queries sent by a framework are untouched; deleting a commander leaves them open for the next commander, exactly as today
- [x] 5.3 The activity entry says how many queries were closed, since the actor cannot see them afterwards

## 6. Verification

- [x] 6.1 Extend `verify-commander-queries.ts`: the ownership predicate — an HR sender may act on their own query and no one else may, including the commander of the framework they were granted under; a framework query is unaffected in either direction
- [x] 6.2 The leak this change exists to prevent, checked directly: after an HR user sends, the commander of that framework's own "sent" list is byte-identical to what it was before
- [x] 6.3 Reach: a framework inside the subtree at depth 3 is valid; a commanded team is valid; an uncommanded framework is not offered; anything outside every granted subtree is refused by the action even when the request is forged
- [x] 6.4 The recorded kind survives a role change — flip the sender's role and prove no query changes hands
- [x] 6.5 Deleting an HR user with open queries closes them and leaves the answers readable; deleting a commander leaves their framework's queries open
- [x] 6.6 Extend the e2e suite: an HR user signs in, sees one panel, sends to two frameworks in their subtree, both commanders see `משא״ן · <name>` as the sender and answer, the tally counts them, and the HR user closes it
- [x] 6.7 Every screen that names a role names משא״ן correctly — read from `ROLE_LABEL`, with no surviving ternary found by grep
- [x] 6.8 `npm run build` and the affected verify suites pass
