# Design: org-tree-import

## Approach

Parse, validate, preview, then one transaction. The same shape the HR import already proved: nothing is written until a human has read what will happen, and what happens then happens completely or not at all.

```
   .xlsx / .csv ──▶ parse (the HR import's parser)
                        │
                        ▼
                    propose a column mapping ──▶ the Admin corrects and APPROVES it
                        │
                        ▼
                    validate WHOLE, by that mapping ──faults──▶ a report by row, and a stop
                        │ clean
                        ▼
                    preview + the cost, in counts read from the database
                        │ approved
                        ▼
                    one transaction: delete all, insert roots-first
```

## Decisions

1. **Three columns: name, kind, parent-name** — the user's choice over a full-path column and over an ordered outline. It is explicit and independent of row order, which means a row moved in Excel cannot silently change the tree. Its one weakness is inherent: a parent name occurring twice in different branches is ambiguous, so **an ambiguous parent is a fault**, named as one, rather than resolved by a guess.

2. **Column mapping before validation, deterministic and without the agent.** The header row is matched against known variants for each of the three meanings («שם», «שם מסגרת», «name»; «סוג», «רמה», «kind»; «אב», «מסגרת אב», «parent»), each column resolving to one meaning or to *ignore* — never to a guess. The proposal is editable and must be approved, and validation reads only the approved columns.

   The personnel import hands unrecognised headers to the agent; this one deliberately does not. That file has dozens of unpredictable columns and the agent earns its place; this one has three, the correction is two clicks, and depending on the Claude CLI for it would make a core admin act fail wherever the agent is unavailable.

3. **Kinds and their nesting moved to `org-nesting.ts`**, imported by both the manual form and the importer. They lived privately inside `org-actions` — a `"use server"` module the client cannot import — so the choice was a shared module or a second copy of the rule. Two copies of "a team's parent is a section" is two truths, and the one that drifts is the one nobody was looking at.

   The same boundary decided where parsing lives: `org-import.ts` is imported by the client component, so it must stay clear of prisma. Parsing (which comes from `hr-import`, which reads the database) therefore happens in the action, and the module holds only recognition, validation and the plan.

4. **Validation is total and pre-write.** Every row is checked and every fault reported in one pass — a validator that stopped at the first would make correcting a 60-row file a sixty-round trip. The faults: unknown kind, missing parent, wrong parent kind, non-center root, duplicate name under one parent, cycle, empty file.

5. **Replacement is `deleteMany` on every node inside the transaction, then insert.** Roots first, then each level, so a parent always exists when its children are written. Deleting the nodes is what cascades the grants and queries away — that is the schema's existing behaviour, not something this change invents, and the confirmation's job is to say it out loud rather than to soften it.

6. **The confirmation counts the real rows** — frameworks, grants, queries, commanders, and people who will be left unassigned — the way `ConfirmDelete` already does everywhere else in this system. A warning that says "the tree will be deleted" while silently taking every manager's visibility with it would be the more dangerous kind of honest.

7. **People survive.** `Person.teamId` is `SetNull`, so cards, plans, progress and history are untouched; they land in the dashboard's «לא משויכים» node, which exists for exactly this. The confirmation says how many.

8. **Not doing: a merge mode.** "Replace" was the request, and a merge that reconciles names across two trees would need an identity for a framework that the file does not carry. Better absent than approximate.

## Risks

- **This is the most destructive act in the application** — more so than the dev wipe, which never touches grants or queries. It is Admin-only, it is behind a counted confirmation, and it is one transaction; the suite asserts each of those.
- **A file that looks right but re-roots the unit** cannot be caught by validation, only by the preview. The preview therefore draws the tree the file describes, not a list of rows.

## Verification

`web/scripts/verify-org-import.ts`:
- parsing: an .xlsx and a .csv of the same content produce the same rows;
- mapping: a file with foreign headers is proposed a mapping and its unknown columns ignored; re-pointing a meaning at another column changes what is validated; approving a mapping with a meaning missing is reported before any row is read;
- validation, one fault at a time, each asserted to be reported AND to write nothing: unknown kind, missing parent, team under a domain, non-center root, duplicate siblings, a cycle, an empty file, an ambiguous parent name;
- a clean file builds exactly the tree it describes, parents before children, at every level;
- replacement: with a tree, people, grants, queries and a commander in place, the counted confirmation matches the database, and after approval the tree is the file's, the grants and queries are gone, the commander is released, and the people survive with no framework;
- atomicity: an import made to fail part-way leaves the previous tree exactly as it was;
- empty system: the preview says there is nothing to replace, and approval simply applies;
- authority: a Manager and an HR user are refused both the preview and the apply.
