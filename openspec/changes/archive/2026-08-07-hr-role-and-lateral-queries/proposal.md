## Why

The system recognises two kinds of people: the Admin who configures it, and Managers who sit somewhere in the org tree. Both are vertical — what you may do follows from where you are, and who you may ask follows from who you command.

Human resources is neither. An HR person works **across** a framework rather than above or below any part of it: they hold the personnel picture for a whole domain, they enrol and release people, and they need to put a question to several commanders at once and collect the answers. Today the only way to give them that is to make them a commander, which takes a framework's single command slot from the officer who actually holds it, or to give them nothing and let the work happen over email where nothing is tracked.

The query page is the right platform for that conversation — it already has a deadline, an answering side, a tally and reminders. What it does not have is a correspondent who is a person rather than a framework.

## What Changes

- **A third role, משא״ן (`HR`).** Operational like a Manager — access comes from grants exactly as it does today — and explicitly not a configuration authority. The Admin still owns users, grants, plan templates and the card schema.
- **A query's sender may be a person.** A query records which kind of correspondent asked it. A framework query behaves exactly as today; an HR query belongs to the HR user who wrote it, and to nobody else — not to the commander of the framework they were granted over.
- **HR asks laterally within their granted subtree.** Every commanded framework beneath the nodes they hold, at any depth, including the granted node itself. The chain rules do not apply to them: no pre-checked "level below", no `@` reach outside their subtree, and teams are addressable.
- **HR only asks.** Their page carries a single panel — the queries they sent. No "for me" panel exists for them, because no framework addresses an HR user.
- **The recipient sees a person, not a framework.** Where a query today reads `מאת תחום אלגוריתמיקה`, an HR query reads `מאת משא״ן · <name>`, on the page and in the notification mail. Answering is unchanged: the commander answers as their framework.
- **Deleting an HR user closes their open queries** rather than deleting them or leaving them open forever. The answers commanders wrote are someone else's work and stay readable; nothing is left running for a user who no longer exists.
- **Establishment authority is not granted by the role.** HR enrols and removes people under the same rule as everyone else — an EDIT grant at section level or above. An HR user who should do it is granted at that level.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `access-control`: a third role joins Admin and Manager; the query page's audience is no longer decided by command alone.
- `commander-queries`: a query's sender may be a person acting laterally rather than a framework acting down the chain.

## Impact

- `prisma/schema.prisma` — `Role` gains `HR`; `Query` gains a sender-kind discriminator. Two migrations' worth of change, no data rewrite: every existing query is a framework query.
- `src/lib/queries.ts` — `isSenderOf`, and the lateral reach rule beside `validRecipient`
- `src/lib/query-actions.ts` — the six ownership guards written as `senderNodeId !== commandsNodeId` collapse onto one predicate, which the page filter and `mayRead` also read; a sender identity that is not always a commander
- `src/app/queries/page.tsx` — one panel or two depending on who is looking; the from-line and the recipient chooser
- `src/components/Header.tsx` — the queries link follows "has a correspondent identity", not "commands a framework"
- `src/lib/access-actions.ts` — the role chooser offers משא״ן; deleting a user closes the queries they sent
- `src/lib/role-labels.ts` (new) — the `ADMIN ? "אדמין" : "מנהל"` ternary exists in four places and cannot survive a third role
- `scripts/verify-commander-queries.ts`, `scripts/verify-commander-queries-e2e.ts` — extended to the lateral sender
