> **Phasing:** Groups 1–7 are the **data half** and must land before the **agent half** (groups 8–10), which reads from them. Group 0 resolves the deferred foundation decisions before code starts. Access control (group 1) comes first because scoping touches every later capability.

## 0. Foundation decisions (resolve before coding)

- [x] 0.1 Choose tech stack (Next.js + TypeScript + Prisma + PostgreSQL; file-storage backend still open) and record it in design.md
- [ ] 0.2 Decide authentication mechanics (the access *model* is already set: Admin + Manager, grants = node + view/edit)
- [x] 0.4 Set localization baseline (Hebrew / RTL) for the UI shell — implemented in the skeleton
- [x] 0.3 Agent runtime decided: claude -p CLI, per-user encrypted API keys, sandbox-snapshot pattern (scheduler for chronic rules still open)
- [x] 0.5 Decide supported person-card field types + validation, and PDF partial-match behavior — types: TEXT/DATE/NUMBER/ENUM; partial match pre-fills what was found, rest manual
- [x] 0.6 Confirm cumulative-metric semantics (running counter + interim checkpoints) and thresholds (🟡 window = 30 days, grace = 0)

## 1. Access control

- [x] 1.1 Model the two roles (Admin/Manager) and exclude the tracked person from being a user
- [x] 1.2 Model access grants as (node, level ∈ view|edit); allow multiple grants per user
- [x] 1.3 Compute effective visibility as the union of granted subtrees, with level per subtree
- [x] 1.4 Enforce edit gates manual data entry; view is read-only; configuration is Admin-only
- [x] 1.5 Constrain the agent to the invoking user's visibility (view suffices; no out-of-scope access) — snapshot export is visibility-clipped
- [x] 1.6 Keep each user's rules page private, even from superiors and the Admin

## 2. Org structure

- [x] 2.1 Model the `center ▸ domain ▸ section ▸ team ▸ person` tree with single-parent constraints
- [x] 2.2 Enforce that people attach only to team-level nodes; resolve a person's org path from their team
- [x] 2.3 Implement generic rollup aggregation up the tree (sum of descendant metrics) — headcount rollup (gap rollup later)
- [x] 2.4 Support drill-down from any aggregate to the contributing people, clipped to the user's scope

## 3. Career plans (Admin-authored)

- [x] 3.1 Model a plan as a relative-to-recruitment template storing month offsets; restrict authoring to Admin
- [x] 3.2 Implement point events (binary, at an offset)
- [x] 3.3 Implement cumulative metrics (name, unit, timed interim targets → planned curve) — targets rendered on the relative timeline; literal curve chart arrives with the gap engine
- [x] 3.4 Implement recurring events (interval + stop condition: date or end-of-service) with occurrence unrolling
- [x] 3.5 Implement plan authoring/editing UI (Admin)
- [x] 3.6 Implement plan copy producing an independent plan

## 4. People registry

- [x] 4.1 Model the Admin-defined person-card field schema (recruitment date always present)
- [x] 4.2 Model the person record against the schema (+ employment status/end-of-service, team placement)
- [x] 4.3 Anchor plan offsets to the person's recruitment date (offset → calendar date)
- [x] 4.4 Assign a plan as an independent copy of a template
- [x] 4.5 Record actual progress: mark point events done (with date); record cumulative metric values (with as-of date)
- [x] 4.6 Ensure employment status/end-of-service bounds recurring occurrence generation

## 5. Data ingestion (agent-assisted, human-committed)

- [x] 5.1 Support uploading a PDF during person creation — also Word/Excel/text
- [x] 5.2 Extract the schema's required fields from the PDF into a draft (no persistence)
- [x] 5.3 Present a pre-filled review form; persist only on Manager confirm — plus per-field approval flow on existing people
- [x] 5.4 Handle failed/partial extraction with manual entry for missing fields

## 6. Evaluations & events page

- [x] 6.1 Model per-person entries holding text and/or file attachments
- [x] 6.2 Generate structured slots from recurring plan occurrences
- [x] 6.3 Support filling a structured slot (content/file) and marking the occurrence satisfied
- [x] 6.4 Support free-form ad-hoc entries alongside structured ones
- [x] 6.5 Implement file upload/storage/retrieval — local-disk backend (uploads/), auth-checked /files route

## 7. Gap engine + surfaces

- [x] 7.1 Derive gap state per plan item from (today, plan, progress) across time and value axes
- [x] 7.2 Implement states ⬜ future → 🟡 approaching/in-progress → 🔴 overdue-and-short/missed
- [x] 7.3 Treat unfilled past-due recurring occurrences as 🔴 gaps
- [x] 7.4 Compute value gaps for cumulative metrics (actual vs. target)
- [x] 7.5 Surface gaps prominently on the individual person card
- [x] 7.6 Build the planned-vs-actual curve view for cumulative metrics
- [x] 7.7 Build the rollup gap dashboard at any tree level, clipped to the user's scope
- [x] 7.8 Wire dashboard drill-down into underlying people

## 8. Agent core (read-only, scope-inheriting)

- [x] 8.1 Establish the read-only reasoning core with a hard no-autonomous-write boundary — claude -p over a temp snapshot copy, tools Read/Grep/Glob only
- [x] 8.2 Constrain the core to the invoking user's visibility scope
- [x] 8.3 Enable reasoning over both structured data and unstructured content (evaluation prose + files)

## 9. Agent rules engine

- [x] 9.1 Build the per-user (private) rules page for authoring natural-language rules — privacy verified (other user gets 404)
- [x] 9.2 Implement one-time execution → output document/file on a dedicated results page
- [x] 9.3 Implement chronic scheduled execution appending to the results page — in-process minute scheduler (DAILY/WEEKLY/MONTHLY)
- [x] 9.4 Implement pin flow: capture the approved output as a golden example
- [x] 9.5 Agent selects realization — deterministic script (computational) vs. locked flow (procedure + style/format template)
- [x] 9.6 Store and re-run pinned realizations faithfully — verified: 22s LLM run → pinned SCRIPT → 0s deterministic 1:1 rerun
- [x] 9.7 (Deferred-permitting) Leave a seam for drift detection vs. the golden example and un-pin/re-pin — un-pin/re-pin implemented; auto drift-detection deferred

## 10. Agent Q&A chat

- [x] 10.1 Build the chat page answering live NL questions over career data via the read-only core
- [x] 10.2 Answer over both structured data and unstructured content — verified reading attachment contents
- [x] 10.3 Make every answer carry its evidence (underlying records), scope, and as-of date
- [x] 10.4 Keep chat stateless (no conversational memory) this version
- [x] 10.5 Implement "save question as rule" bridging chat into the rules page (answer = candidate golden example)
