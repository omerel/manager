# Design: dev-data-wipe

## Context

`reset-db.mjs` already ships for the scorched-earth case. This tool is its surgical sibling, living in the UI, scoped by category, and gated to development. The schema's cascade rules do most of the work — the design's job is to name exactly which roots each category deletes and what deliberately survives.

## Decisions

### Category → deletion roots

| Category | Roots deleted | What cascades along |
|---|---|---|
| אנשים | `Person`, then `CareerPlan` where `isTemplate: false`, `PersonDraft`, `PersonMovement`, `ExtractionProposal`, `ImportSnapshot` | assignments, evaluations + attachments, point progress, metric readings, field values, person-scoped agent runs |
| קריירה | `CareerPlan` (templates AND copies) | plan items (point events, metrics + checkpoints, recurring events), assignments, waivers, carry-overs; people's `assignedPlanId` nulls out |
| שאלות | `AgentRun` where `kind: "CHAT"` | — (chat Q&A runs only; rule runs and extract runs belong to their owners) |
| חוקים | `Rule` | the rule's agent runs |
| שאילתות | `Query` | query targets |

Never touched: `User`, `AccessGrant`, `OrgNode`, `AppSetting`, `ActivityLog`, `PersonFieldDef`, `ImportMapping` — accounts, hierarchy, configuration and audit are not "data" in this tool's sense. Person-plan copies ride with אנשים because an assignment copy without its person is an orphan the plans page would show as noise; templates ride only with קריירה.

Order inside one run: אנשים before קריירה is irrelevant (both may be ticked; deletes are idempotent), but within אנשים the copies are deleted AFTER the people so the cascade from `Person` clears the assignments first. All deletes run in one transaction — a half-wiped database is worse than either state.

### The gate is double

The section renders only when `process.env.NODE_ENV !== "production"`, and the action re-checks the same condition and `requireAdmin()` before touching anything. The UI check is convenience; the action check is the guarantee — a stale client or a hand-crafted POST in production gets a refusal, not a wipe. No env-var override: if it is a production build, the tool does not exist.

### Flow: tick → warn → count

A client component (`DevWipe.tsx`): checkboxes for the five categories; the delete button disabled until at least one is ticked; clicking it swaps the button row for an inline warning naming the ticked categories («פעולה זו תמחק לצמיתות: אנשים, שאילתות. להמשיך?») with אישור מחיקה (red) and ביטול. Confirmation submits the action via `useActionState`; the result renders as a green notice with per-category counts («נמחקו: 34 אנשים, 12 שאילתות») — the success indication the user asked for, with evidence. An inline warning rather than the `ConfirmDelete` modal keeps the whole ceremony inside the section — nothing else on the page is at stake.

### Counts come from the deletes themselves

Each `deleteMany` returns `count`; the action reports the ROOT counts per category (people deleted, plans deleted, …), not the cascade totals — honest, cheap, and matches what the user ticked. The activity-log entry names the categories and root counts in one Hebrew sentence.

## Risks / Trade-offs

- **`NODE_ENV` as the switch**: `next dev` sets development, the shipped image runs `next start` → production. This is exactly the boundary wanted, with no new configuration to forget. The cost — you cannot enable the tool on a production build even deliberately — is the point.
- Deleting אנשים without קריירה leaves templates intact (wanted), and deleting קריירה without אנשים leaves people unassigned but present (also wanted). Ticking both is the common "start over" case and works in one pass.
