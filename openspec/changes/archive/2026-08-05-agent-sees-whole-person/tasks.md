## 1. Reproduce before fixing

- [x] 1.1 Write the failing check first: build a real snapshot and assert it carries the date of birth of a person who has one — confirm it fails now, so the fix is proven to be the thing that turns it green
- [x] 1.2 Record the actual numbers in the check's output (people with a date of birth, of how many) so a future reader can see the fault was real and not theoretical

## 2. The person card's core fields

- [x] 2.1 Add the date of birth to the snapshot, ISO like every other date, `null` where none is recorded rather than omitted
- [x] 2.2 Add the age from `ageFromBirthDate` — the card's own function, not a second calculation
- [x] 2.3 Sweep the card's core fields against the snapshot by hand once, and fix anything else the sweep turns up

## 3. Field definitions

- [x] 3.1 Export the configurable field definitions — label, type, and the options of a choice field — to their own file in the snapshot
- [x] 3.2 Name the file in the README the agent reads, saying plainly that a field may exist with no values recorded against it

## 4. One date convention

- [x] 4.1 Normalise configurable date-field values to ISO on export, carrying an unreadable value through unchanged rather than guessing
- [x] 4.2 Prove it on a date field created for the test — none exists in the data today, which is why this is latent rather than visible

## 5. The check that keeps them in step

- [x] 5.1 Write `scripts/verify-agent-snapshot.ts` as a COMPARISON: read the card's core fields from where the card defines them, and require each to be represented in the snapshot
- [x] 5.2 Prove the comparison bites — remove a field from the export in a scratch run and confirm the check fails naming it, rather than trusting that it would
- [x] 5.3 Cover the three answers that must differ: a field with values, a field with none, and a field that does not exist — the middle case had to be created, since every configured field happens to hold at least one value
- [x] 5.4 Assert the snapshot still exposes nothing new — no file paths, no internal ids — since this change widens what it carries
- [x] 5.5 Run twice in a row, `npx tsc --noEmit`, and `npm run build`

## 6. Confirm the original complaint is gone

- [x] 6.1 Ask the real question through the questions page — a list of birthdays — and confirm an answer comes back with dates in it
