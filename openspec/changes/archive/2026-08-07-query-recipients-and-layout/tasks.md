## 1. The rules

- [x] 1.1 Replace `canReceiveAt(kind)` with "any commander receives" — the for-me side belongs to every commander now — while `canSendFrom` keeps refusing teams
- [x] 1.2 Add `commandedFrameworks()` — every framework with a commander, full path and commander name, for the ‎@‎ picker
- [x] 1.3 Add `validRecipient(senderNodeId, nodeId)` — a direct child, or any commanded framework — used by the action, not only the form

## 2. The action

- [x] 2.1 `createQuery` accepts an explicit recipient list, refuses an empty one, and validates each entry server-side
- [x] 2.2 Sending untouched defaults must produce byte-identical target rows to today — the regression the whole change must not cause
- [x] 2.3 Mail goes to each chosen recipient's commander exactly as it went to the level below — no second mail path

## 3. The recipient chooser

- [x] 3.1 Checkbox list of the level below, all pre-checked, uncommanded frameworks shown as "אין מפקד" and still checkable
- [x] 3.2 ‎@‎ opens a picker over commanded frameworks anywhere in the tree, labelled by path and commander; chosen ones join the list and can be removed before sending
- [x] 3.3 Typing alone never adds a recipient — only choosing does, same discipline as the person-tag picker

## 4. The two-panel layout

- [x] 4.1 Two columns: mine on the right, "שאילתות עבורי" on the left — renamed from "שאילתות רמה ממונה" everywhere it appears
- [x] 4.2 The for-me panel renders for every commander, empty with an explanation when nobody has asked them anything
- [x] 4.3 Open queries first as full cards; closed ones collapse to a `<details>` summary — green check, title, tally, deadline — expanding to the full card with all actions intact
- [x] 4.4 A side chooser (הכל / שלי / עבורי) carried in the address alongside the search; columns stack on narrow screens
- [x] 4.5 Search applies within each visible panel

## 5. Verification

- [x] 5.1 Extend `verify-commander-queries.ts`: recipient validation (child ok, commanded-elsewhere ok, uncommanded-elsewhere refused, empty refused), any-commander-receives, and the untouched-default byte-identity
- [x] 5.2 Extend the e2e suite: uncheck a default recipient and prove that framework got nothing; ‎@‎-add a cross-branch commander and prove they see, answer, and are tallied; a center commander receives; closed queries render collapsed with the check and expand to working actions; the side chooser narrows and survives reload
- [x] 5.3 The existing checks stay green, with exactly two kinds of exception, both driven by requirements this change MODIFIED: the canReceiveAt assertions flipped with the rule they assert, and three UI checks now expand the fold before reaching text and buttons that legitimately hide inside it. Nothing else was edited
- [x] 5.4 Run both suites twice, `npx tsc --noEmit`, `npm run build`
