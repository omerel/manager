## Context

This is a greenfield system for managing the careers of researchers, engineers, and developers in an organization. It emerged from an exploration session that crystallized the domain into two halves:

- A **human-owned data half**: an org tree, career-plan templates, a people registry with progress and evaluations, and a derived gap engine.
- A **read-only agent half**: a rules engine and a Q&A chat, both operating over the same data without ever mutating it.

Users are an **Admin** (מנהלן, who owns configuration and access) and **Managers** (view/edit); the tracked person is never a user. The UI is Hebrew (RTL) and the domain vocabulary is Hebrew. The *access model* is decided (D9/D10). **Stack (decided):** Next.js (App Router) + TypeScript + Prisma + PostgreSQL, single repo; the read-only agent half is a separable service (may be added in Python later if RAG/PDF/script-execution needs it — see D6/D7). Deferred: authentication mechanics, agent runtime/scheduler, file-storage backend (see Open Questions). This document records the architectural shape and the decisions already made, so implementation can proceed in phases.

## Goals / Non-Goals

**Goals:**
- Model career plans as **relative-to-recruitment templates** so one plan serves many people.
- Support three event kinds — point, cumulative, recurring — under one plan.
- Derive gaps (never hand-set) across a **time axis** and a **value axis**, and roll them up the org tree.
- Scope access by **position in the tree** (grants = node + view/edit) and have the agent inherit that scope, making cross-framework leakage structurally impossible.
- Let the Admin configure the **person-card schema** and career-plan templates centrally.
- Provide a **read-only** agent surface (rules + chat) with **no autonomous write authority**: it renders documents/reports or pre-fills drafts, but every source-of-truth write is a human action.
- Let approved rule outputs be **pinned** for faithful reproduction, with the agent choosing script vs. locked-flow realization.

**Non-Goals (this version):**
- Agent write-back / actions on existing data (marking milestones, opening course registrations) — explicitly excluded. (Agent-assisted *ingestion* is a draft the human commits, not an autonomous write.)
- Delegated permission management (only the Admin grants access), authentication mechanics, and multi-org tenancy.
- Conversational memory / follow-up context in chat (stateless this version).
- Automatic drift-detection enforcement (the model must *permit* it; building it is deferred).
- A chosen tech stack, storage engine, and scheduler implementation.

## Decisions

**D1 — Timeline is relative to recruitment; recruitment date is the sole anchor.**
Plans store month offsets (+1, +9, +12), and each person's recruitment date converts offsets into calendar dates. *Why:* makes templates reusable and copyable across people. *Alternative rejected:* absolute calendar dates per plan — would force re-authoring per person.

**D2 — Assigning a plan copies the template.**
A person's assigned plan is an independent copy, so template edits don't retroactively rewrite history. *Why:* preserves each person's plan-as-agreed. *Alternative rejected:* live reference to the template — edits would silently mutate everyone's expectations.

**D3 — Three first-class event types.**
`Point` (binary), `Cumulative` (a live measure with timed interim targets → planned vs. actual curve), `Recurring` (defined once, auto-unrolls at an interval; stops at a date or end-of-service). *Why:* the domain genuinely contains one-time, accumulating, and repeating expectations; collapsing them loses meaning.

**D4 — Recurring occurrences are both a schedule and a content container.**
Each occurrence generates a structured slot on the person's evaluations & events page; an unfilled past-due slot is a gap. *Why:* unifies "when is it due" with "what was filed" and makes gap logic uniform across all event types.

**D5 — Gaps are derived, two-axis, and roll up the tree.**
Gap = f(today, plan, progress) over TIME (on-time/late) and VALUE (met/short), producing ⬜ → 🟡 → 🔴. Aggregation is a pure sum up `center ▸ domain ▸ section ▸ team`. *Why:* a single derivation feeds both the person card and every dashboard level; nothing is manually maintained.

**D6 — The agent has no autonomous write authority ("proposes, human commits").**
The agent reads career data within scope and *proposes*: for rules/chat it renders documents/reports; for ingestion it pre-fills a draft form. It never persists to source-of-truth data on its own — every write is a human action. *Why:* the manager stays sole owner of truth, which removes agent write-permissions and mutation-auditing from scope, while still letting the agent assist data entry. This is the system's central invariant. *Refinement note:* this is the evolution of the original "the agent never writes" rule — PDF ingestion (D11) showed the agent must be able to *draft* data, so the boundary moved from "no write" to "no autonomous write."

**D7 — Rules and chat are two surfaces of one read-only engine.**
Rules are *saved, scheduled, pinnable* queries; chat is the *live, stateless* sibling. A useful chat question can be promoted into a rule (its approved answer is the candidate golden example). *Why:* one reasoning core, two interaction modes; avoids duplicating logic. Chat is stateless in this version (no conversational memory) to keep it simple; every chat answer must carry the underlying records as evidence, because there is no per-answer pinning to establish trust.

**D8 — "Deterministic" means fidelity to an approved output, not "no LLM".**
On pin, the approved output becomes a golden example. The agent itself chooses the realization: a deterministic **script** for computational rules (reproduces 1:1) or a **locked flow** (procedure + style/format template) for generative rules (consistent, not byte-identical). The golden example doubles as an imitation template and a post-run sanity check. *Why:* matches the user's actual intent — "give me the same style/output next time" — across both computational and generative rules. *Alternative rejected:* forcing pin to mean pure code — would exclude generative rules, which are most of the value.

**D9 — Access is a position in the tree, not a permission list.**
An access grant is `(node, level ∈ view|edit)`; a user's visibility is the union of the subtrees rooted at their granted nodes. Rollups and dashboards naturally clip to a user's node. The read-only agent inherits this visibility, so a rule/chat physically cannot reach data outside the user's frameworks — no explicit filtering to forget. *Why:* reuses the org tree we already model; makes leakage structurally impossible. *Alternative rejected:* per-object ACLs — more expressive but far more error-prone for this hierarchy-shaped domain.

**D10 — Two roles; data and personal workspace have different sharing rules.**
**Admin** (מנהלן = אדמין) is the single authority for user/access management, plan templates, and the person-card schema. **Managers** operate at view/edit. The tracked **person** is never a user. Career *data* is shared upward per the tree, but the *rules page* is a private personal workspace — invisible even to a superior who can see the data the rules run on. *Why:* configuration authority must be centralized and auditable; personal automations are drafts, not shared records.

**D11 — Person card is a configurable schema; ingestion targets it.**
The Admin defines the person-card fields (with recruitment date always present as the timeline anchor). Those fields are also the "required fields" the PDF-ingestion agent tries to extract into a draft. *Why:* organizations differ in what they track; hard-coding the card would not survive contact with real use, and coupling ingestion to the schema keeps extraction aligned with what the card actually needs.

## Risks / Trade-offs

- **Locked-flow output is consistent, not identical** → keep the golden example as a sanity-check reference so material drift can be flagged rather than silently published.
- **Agent self-selects script vs. flow silently** → the pin should remain inspectable and reversible (un-pin), so a wrong self-assessment is recoverable.
- **Cumulative metrics imply a running measure with history** → store actual values with an as-of date so planned-vs-actual curves are reconstructable, rather than only a latest snapshot.
- **Recurring unrolling depends on employment status** → end-of-service must reliably bound occurrence generation, or dashboards will show phantom gaps for departed people.
- **Undefined permission model** → building the data half before deciding "who sees which frameworks" risks rework in the rules/chat scoping; mitigate by treating per-user scoping as a seam from day one even while deferring the full model.

## Migration Plan

Greenfield — no migration. Phased build:
1. **Data half**: `access-control` → `org-structure` → `career-plans` → `people-registry` → `evaluations-and-events` → `gap-engine`.
2. **Agent half**: `data-ingestion` assist → `agent-rules-engine` → `agent-qa-chat`, reading from the data half.
Each phase is independently demoable; the agent half cannot begin until the gap engine and data model exist. `access-control` comes first because scoping touches every subsequent capability.

## Open Questions

- **Tech stack**: decided — Next.js + TypeScript + Prisma + PostgreSQL. Still open: file-storage backend for attachments (disk vs. object storage).
- **Agent runtime & scheduler**: where the read-only agent runs, and how chronic triggers are scheduled and executed.
- **Person-card schema**: which field *types* are supported (text/date/enum/number/…) and what validation the Admin can attach.
- **PDF ingestion behavior**: accepted formats, and how partial matches are surfaced/confirmed field-by-field.
- **Approaching-window & grace**: the exact threshold for 🟡 "approaching" and whether milestones get a grace period before turning 🔴.
- **Metric semantics**: confirm cumulative metrics are single running counters with interim checkpoints (vs. independent per-milestone targets).
