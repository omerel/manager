## Why

A full project sweep (tsc, build, lint, all 21 verification suites, backup-vs-schema audit, docs-vs-reality audit) found the code healthy and four things not.

The serious one: the backup bundle does not know about `Query`, `QueryTarget` or `ActivityLog`. This is the third drift of the same hand-maintained table list. It is worse than an omission this time: restore wipes every `OrgNode` and recreates them, and `Query.senderNodeId` cascades on that delete — so a backup→restore round trip **destroys all commander queries and the audit trail**, and the bundle holds nothing to bring them back. The activity-log spec explicitly requires entries to remain readable after their subject is gone; a restore currently erases all of them.

Alongside it: three verification suites fail for reasons that are not engine bugs — an unguarded fixture pick and two wording drifts between surfaces — and a red guard that stays red trains people to ignore red. And the documentation contradicts the running system in three places, most visibly a README section that lists the gap engine, career plans, ingestion and the agent as "not yet built".

## What Changes

- **Backup covers queries and the activity log.** `query`, `queryTarget` and `activityLog` join the bundle — dumped, wiped in dependency order, restored after the frameworks and users they reference. A backup taken before this change still restores (the keys are simply absent); the round-trip verification extends to count them.
- **The three failing verification suites are made honest.**
  - `verify-placement-anchor` picks its subject deterministically and guards it: no end-of-service date (occurrence clipping breaks index-aligned comparison), and a placement history that actually makes the two axes differ in the direction the waiver assertion assumes.
  - `verify-intake` and `verify-delete-authz`: one canonical wording per surface pair. The intake link text and the end-of-service field label are each written once and read by both the UI and the check, so the two cannot drift apart again — the same single-source pattern as `eval-scale.ts`.
- **Documentation is brought back to the truth.**
  - README: the "Not yet built" section dies; "What the app shows" describes the system that exists — plans, gaps, agent, queries, activity log, email, intake.
  - `people-registry` spec: the recruitment-date requirement loses its now-false rationale ("since plan offsets anchor to it") — the date stays, as history; the anchor is placement, as the spec itself says 20 lines later.
  - The dist guide documents the email contract: `docker/emailer.py` is a stand-in the target environment must replace, with the three flags and the last-line verdict spelled out for the operator.
- **Lint returns to zero.** The three `Date.now()`-during-render errors and three unused symbols.
- The stray `fix pahse` requirements file moves out of the repo root into the archive of the change it produced.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `data-portability`: the full bundle includes commander queries and the activity log; a restore round trip preserves both.
- `people-registry`: the recruitment-date requirement is re-justified as service history, not as the plan anchor.

## Impact

- `web/src/lib/portability.ts` — three tables in dump, wipe and restore
- `web/scripts/verify-placement-anchor.ts`, `verify-intake.ts`, `verify-delete-authz.ts` — fixture guards and shared wordings
- `web/src/components/IntakeSection.tsx`, `PersonFormFields.tsx`, `src/lib/person-schema.ts` — wording single-sourced
- `web/README.md`, `deploy/build-dist.sh` (dist guide heredoc), `openspec/specs/people-registry/spec.md`
- Lint touches: `people/[id]/page.tsx`, `people/new/page.tsx`, `rules/[id]/page.tsx`, `queries/page.tsx`, `src/lib/queries.ts`
- No schema change, no migration, no new dependency
