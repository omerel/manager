## 1. Data model

- [x] 1.1 Add `Query` (senderNodeId, authorId nullable, title, body, dueDate, timestamps) and `QueryTarget` (queryId, nodeId, answer, answeredById, answeredAt, updatedAt, remindedAt, mail outcome) with a unique index on `(queryId, nodeId)`
- [x] 1.2 Decide and record the delete behaviour per foreign key: deleting a framework removes its target rows and its sent queries; deleting a user nulls the author fields and keeps the text
- [x] 1.3 Generate the migration with `migrate diff` (the environment is non-interactive), read the SQL, apply it
- [x] 1.4 Prove against the database: deleting a framework mid-query leaves the other targets intact, and deleting an author leaves the query readable with the text preserved

## 2. The rules of who may act

- [x] 2.1 Write `recipientsOf(commandedNodeId)` returning the child frameworks and their current commanders — one definition, used by the send action, the page, and the reminder
- [x] 2.2 Derive send/receive capability from the commanded framework's kind, and refuse the page outright to a user who commands nothing
- [x] 2.3 Refuse a send from a framework with no children, naming why
- [x] 2.4 Write `isOpen(dueDate, today)` as the single derivation of open/closed — inclusive through the end of the due date — and use it everywhere, storing no status
- [x] 2.5 Write the visibility predicate: a query is readable only by the sending framework's commander and the addressed framework's commander, with no Admin exception

## 3. Server actions

- [x] 3.1 `createQuery` — validate, create the query and one target row per child framework, including frameworks with no commander
- [x] 3.2 `answerQuery` — accept from the current commander of the target framework only, refuse once closed, set `answeredAt` on the first answer and `updatedAt` on each revision
- [x] 3.3 `updateQueryDue` — always permitted to the sender; reopening follows from the derivation with no extra path; shortening below today requires the confirmation to have been given
- [x] 3.4 `updateQueryContent` — permitted only while no target has answered, refused after with the reason
- [x] 3.5 `remindTarget` — only for targets that have not answered, recording when

## 4. Mail

- [x] 4.1 Send the notification to each target framework's commander via `after()`, skipping frameworks with no commander
- [x] 4.2 Record each send's outcome on the target row, and surface a failure in the sender's list
- [x] 4.3 Reuse the same path for the manual reminder — one notification route, not two

## 5. The page

- [x] 5.1 `/queries` with the three sections, each hidden when it cannot apply (no create for a team commander, no superior section for a center commander)
- [x] 5.2 Create form: title, short body, deadline via `DateField`
- [x] 5.3 "שאילתות שלי": one row per target framework — answered / not answered / no commander, with the answer, its last-changed date, the mail outcome, and the reminder button
- [x] 5.4 A framework with no commander links to the access page, presented as a task rather than an error
- [x] 5.5 "שאילתות רמה ממונה": answer and revise while open, read-only after, showing the deadline and whether it was moved
- [x] 5.6 Deadline editing on the sender's side, with the shortening confirmation naming how many have not answered
- [x] 5.7 Nav item with an outstanding count for the signed-in commander

## 6. The agent

- [x] 6.1 Extend the snapshot with the user's own queries — sent and received, full content — as an explicitly separate scope from career visibility, named as such in the code
- [x] 6.2 Prove the second axis holds: a commander cannot reach an exchange between a domain and its sections even where those frameworks are inside their career visibility

## 7. Verification

- [x] 7.1 `scripts/verify-commander-queries.ts` — the rules layer: who may send, who may answer, the derived open/closed across a moved deadline, content freezing on the first answer, and the visibility predicate including the Admin having no exception
- [x] 7.2 Cover the commander-swap cases directly: replaced mid-query on both ends, appointed after sending, command cleared before answering
- [x] 7.3 `scripts/verify-commander-queries-e2e.ts` — the actions through the real forms, since the actions begin with a session check that a bare script cannot satisfy
- [x] 7.4 Run both twice in a row, and once with fixtures planted, to prove they are idempotent
- [x] 7.5 `npx tsc --noEmit` and `npm run build`

## 8. Closing a query, and refusing a past deadline

- [x] 8.1 Add `closedAt` to `Query` and fold it into the single `isOpen` derivation — `open ⟺ closedAt is null AND today ≤ dueDate` — taking the query rather than a bare date so no caller can ask half the question
- [x] 8.2 Refuse a past deadline in `updateQueryDue` as an ordinary validation message naming the date and pointing at the close action; drop the confirmation-by-exception entirely
- [x] 8.3 Give `DateField` a `minDate` so the native calendar cannot offer a past day, with the server still the guard
- [x] 8.4 `closeQuery` — recording that it ended early WITHOUT touching the stated deadline
- [x] 8.5 `reopenQuery` — the undo, restoring whatever the deadline says and not resurrecting a lapsed one
- [x] 8.6 `ConfirmSubmit` — confirm in front of the action, naming how many answered and how many will lose the chance
- [x] 8.7 Show the state honestly on both sides: closed-by-sender reads differently from lapsed, and the outstanding counter stops nagging on an early close
- [x] 8.8 Extend both suites: the past-date refusal, the calendar floor, the deadline surviving a closure, the receiver being told which it was, and reopening restoring the answer already given

## 9. Tagging a person

- [x] 9.1 `src/lib/mentions.ts` — the `@[label](id)` token, parse, id extraction, and flattening; the id is the reference and the label only a fallback
- [x] 9.2 `MentionTextarea` — `@` at a word boundary opens a picker over people the writer can see; typing alone never creates a tag, only choosing does
- [x] 9.3 `MentionText` — link for a person the reader can see (new tab), plain text where they cannot, stored label where the person is gone
- [x] 9.4 Wire into the query body and the answer, on both the create and edit paths, and render in all four places the text is shown
- [x] 9.5 Flatten tags in the notification email and in the agent snapshot — both read the text rather than render it
- [x] 9.6 Cover in both suites: the token round-trip, things that must NOT parse as tags (bare `@name`, email addresses, markdown links), rename, deletion, the picker in a browser, the link opening the person, and a reader without access getting no dead link

## 10. Deleting, the asker's notification, and search

- [x] 10.1 `deleteQuery` — sender only; recipients' copies go via the FK cascade that already exists, with the confirmation naming how many answers will be destroyed
- [x] 10.2 `seenBySender` on the target row, reset by every answer AND every revision — "new since I looked" is a fact about the reader that no timestamp on the answer supplies
- [x] 10.3 Email the sending framework's current commander when an answer arrives, distinguishing a first answer from an update
- [x] 10.4 Split the header badge into its two meanings — awaiting my answer, and unread answers to mine — showing the sum and naming the parts
- [x] 10.5 Clear the unread mark in `after()`, never during render, so a prefetch cannot silently clear the badge
- [x] 10.6 Search across both sections: title, body, answers and the framework at the other end, with an empty result that says so
- [x] 10.7 Cover in both suites: the cascade leaving no orphan rows, the badge's two halves staying separable, a revision counting as news again, reading clearing it, and search by answer text and by framework name
