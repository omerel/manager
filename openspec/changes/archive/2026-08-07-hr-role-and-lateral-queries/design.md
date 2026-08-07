## Context

A query is correspondence between **frameworks**. That is not a convention, it is the schema:

```
Query.senderNodeId  ──▶ OrgNode        mayRead(user, query):
QueryTarget.nodeId  ──▶ OrgNode          mine = user.commandsNodeId
Query.authorId      ──▶ User?            if (!mine) return false
                                         sender === mine || targets.includes(mine)
```

An HR user commands nothing, so today they fall at the second line and see nothing at all. Worse, if they were simply allowed to send "from" the framework they are granted over, the commander of that framework would find HR's correspondence listed among their own — `senderNodeId === mine` cannot tell the two apart.

The half that already exists is `authorId`: `createQuery` has always recorded *who typed it* separately from *which framework asked*. The system already distinguishes the two; it has just never had a reason to let the author be the correspondent.

The real cost is not the schema. "Who is the sender" is written **eight times**: six guards in `query-actions.ts` — `deleteQuery`, `updateQueryDue`, `updateQueryContent`, `closeQuery`, `reopenQuery`, `remindTarget` — each as `query.senderNodeId !== me.commandsNodeId`, plus the page's `where: { senderNodeId: mine }` and `mayRead`'s sender branch. Eight copies of a rule that is about to gain a second case.

## Goals / Non-Goals

**Goals:**

- Let an HR user hold a tracked conversation with the commanders inside their granted subtree, using the query machinery unchanged on the answering side.
- Make "who owns this query" one definition that eight call sites read, rather than eight comparisons that must all be edited in step.
- Keep the recipient able to tell a lateral request from an order down the chain, on the page and in the mail.

**Non-Goals:**

- Putting HR into the chain of command. They command nothing and confer nothing; the framework they are granted over keeps its own commander.
- Letting anyone address an HR user. Queries flow to frameworks; HR is a person, and their page has one direction.
- Rules distributed to a mailing list. Considered in the same discussion and dropped: a scheduled rule that keeps mailing a list long after its author has left is an automation nobody owns. Today's `emailOnRun` reaches exactly one inbox — the author's — which is what keeps it contained.
- Any change to establishment authority. HR enrols and removes under the section-level rule like everyone else.

## Decisions

### D1 — The sender's kind is recorded, not inferred

`Query` gains `senderKind: FRAMEWORK | STAFF`. The alternative — inferring from the author's role — was rejected: a user's role can change after the fact, and a query would then silently change hands. The correspondence must mean the same thing in a year as it does today, so the fact is written down when it happens.

`senderNodeId` stays required and keeps its cascade. For a STAFF query it records **the framework the request was made under**, which is what bounded the reach at the time — an audit fact, never a display one. The sender line for a STAFF query never shows it.

### D2 — One ownership predicate, eight readers

```
isSenderOf(user, query):
  ┌ FRAMEWORK →  user.commandsNodeId === query.senderNodeId
  └ STAFF     →  user.id === query.authorId
```

Every guard in `query-actions.ts` calls it; the page's "sent" list is the same rule expressed as a query filter. This is the pattern the project has now applied three times — `mayEstablishAt`, `readLabeledFields`, and here — and the reason is always the same: a rule stated in eight places drifts in one of them, and the drift is silent.

`mayRead` gains the same branch on its sender side. Its recipient side does not change at all: a commander reads a query addressed to their framework, whoever sent it.

### D3 — Reach is the granted subtree, and the chain rules do not apply

```
   HR granted EDIT on תחום אלגוריתמיקה
     ├── מדור ראייה         commanded  ✔
     │     ├── צוות פיקסל   uncommanded ✗ not offered
     │     └── צוות עדשה    commanded  ✔
     └── מדור שפה           commanded  ✔
```

Three rules that hold for commanders are deliberately absent:

- **No pre-checked default.** "The level below" is a chain concept. HR chooses, with a select-all.
- **No `@`.** A commander may reach a commanded framework anywhere in the tree. HR's entire definition is *lateral within what they were granted*; `@` would erase it.
- **Teams are addressable.** `canSendFrom` refuses teams because a team has nothing beneath it — a rule about sending, not about receiving. It never applied to a recipient.

Uncommanded frameworks are not offered to HR at all, unlike the commander's chooser which shows them as `אין מפקד` and lets the sender apply pressure anyway. HR is outside the chain and has no pressure to apply, so a row nobody can answer is only a broken tally.

Several grants union into one list. Deciding per-send which grant one is acting under would be a question the user cannot answer meaningfully — they are the same person either way.

### D4 — HR only asks

Their page has one panel. Not an empty "for me" panel with an explanation — no panel, because nothing will ever populate it. `answerQuery` stays behind `requireCommander` untouched.

### D5 — The from-line is what makes lateral real

```
commander asks   →  מאת תחום אלגוריתמיקה     ← a request from above
HR asks          →  מאת משא״ן · רונית לוי    ← a lateral request
```

Two places: the recipient's card on `/queries`, and the notification mail body. If both read alike, the separation exists in the schema and not in the experience — the commander answers an HR request as though it came from their superior, which is precisely what keeping HR out of the chain is meant to prevent.

### D6 — Deleting an HR user closes their open queries

`authorId` is `onDelete: SetNull` — correct today, because the framework carries the ownership and the query survives a change of commander. For a STAFF query the author *is* the correspondent, so SetNull would leave a query nobody can close, edit or delete, sitting open in every recipient's panel forever.

Deleting the queries outright was rejected: the answers commanders wrote are their work, not HR's. So deletion closes them — `closedAt` set, correspondence readable, nothing left running for a user who no longer exists. This is the same objection that removed rule distribution lists from scope, applied consistently.

### D7 — A third role needs a label map, not a third ternary

`role === "ADMIN" ? "אדמין" : "מנהל"` appears in four places. With three roles every one of them silently labels HR as "מנהל". A `ROLE_LABEL` map in a client-safe module replaces all four — the same reason `org-kinds.ts` and `gap-meta.ts` exist.

## Risks / Trade-offs

- **A second kind of correspondent in a system built around one** → held by D2: there is one predicate, and adding a third kind later means one more branch rather than another eight edits.
- **`senderNodeId` on a STAFF query could be rendered as the sender by a future page** → the column's comment says what it is for, and the from-line goes through one helper that branches on kind.
- **HR reach follows grants, which the Admin changes freely** → reach is evaluated at send time, like every other authority in the system. An HR user whose grant is narrowed keeps the queries they already sent, and cannot address the lost frameworks again.
- **An HR user could be given a grant at team level and expect to enrol people** → deliberately refused; the section-level rule is not weakened by role. Worth saying out loud in the role's own documentation, because the expectation is natural.

## Migration Plan

`senderKind` defaults to `FRAMEWORK`, so every existing query keeps its exact meaning with no backfill. `Role` gains a value; no existing user changes role. Nothing to run beyond `prisma migrate deploy`, which the container already does on boot.

## Open Questions

None. Settled in discussion: HR sends as themselves rather than under a framework; their page shows only what they asked; no `@` beyond their subtree; deleting the user closes their open queries; rule distribution lists are out of scope.
