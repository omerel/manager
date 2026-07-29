## Why

Managing the career progression of researchers, engineers, and developers in an organization is today informal and scattered — there is no single place to define what is expected of a role holder over time, to track each person against that expectation, or to see at a glance who is falling behind. Managers also repeatedly perform the same reporting and drafting work by hand. This system gives an organization a structured, dynamic career plan per role, a live view of every person relative to their plan, and a read-only agent that answers questions and turns recurring reporting into reusable, faithful automations — while the humans remain the sole authors of the source-of-truth data.

## What Changes

- **Two roles + a non-user subject.** An **Admin** (מנהלן, also the אדמין) is the sole authority for user/access management, career-plan templates, and the person-card field schema. **Managers** (מנהל) do the operational work at a **view** or **edit** level. The tracked **person** (איש) is never a user — purely data.
- **Access by position in the tree.** An access grant is a pair `(org node, level ∈ view|edit)`; a user may hold several. Effective visibility is the union of the granted subtrees. **Edit** gates manual data entry; **view** is read-only. The read-only agent inherits the user's visibility (so **view** suffices for full agent use), which structurally prevents cross-framework leakage.
- **Organizational tree.** A strict 4-level hierarchy `מרכז ▸ תחום ▸ מדור ▸ צוות` (center ▸ domain ▸ section ▸ team) with people as leaves; every aggregation rolls up this tree.
- **Career plans as copyable templates** (Admin-authored), defined at month granularity **relative to recruitment date**. Three event types:
  - **Point event** (אירוע נקודתי) — one-time, binary.
  - **Cumulative metric** (אירוע מצטבר) — a live accumulating measure with timed interim targets; planned vs. actual curve.
  - **Recurring event** (אירוע כרוני) — defined once, auto-unrolls at a fixed interval, stopping at a date or at end of service.
- **People registry with a configurable card.** The Admin defines which personal-detail fields exist on the person card. A person carries recruitment date, employment status/end-of-service, org placement, and an assigned plan that is a *copy* of a template. Managers record actual progress.
- **Agent-assisted ingestion.** Creating a person may start from an uploaded PDF: the agent extracts the schema's fields into a **draft** form; the Manager reviews and saves (manual fallback on failure). The agent never persists data on its own.
- **Evaluations & events page** (חוות דעת ואירועים) per person: text + file attachments, populated both by plan-driven recurring slots and freely.
- **Gap engine & rollup dashboards.** Gaps are derived from today's date + plan + progress across two axes (TIME and VALUE), with states ⬜ → 🟡 → 🔴; unfilled past-due recurring occurrences count as gaps. Prominent on the person card and on a rollup dashboard at any tree level.
- **Read-only rules engine** (דף חוקים, private per user): natural-language rules run one-time or chronically, producing a document/file on a results page. A rule can be **pinned** so the agent faithfully reproduces an approved output — realized (by the agent's own judgment) as a deterministic script or a locked flow.
- **Read-only Q&A chat** (דף שאלות): the interactive, stateless sibling of the rules engine. Answers questions over **both** structured data and unstructured content (evaluation prose + attached files), and **every answer carries its evidence**.

## Capabilities

### New Capabilities
- `access-control`: Roles (Admin/Manager), grants (node + view/edit), union-of-subtrees visibility, agent scope inheritance, and the per-user privacy of the rules page.
- `org-structure`: The `center ▸ domain ▸ section ▸ team ▸ person` hierarchy and rollup semantics.
- `career-plans`: Admin-authored relative-to-recruitment templates and the three event types (point, cumulative, recurring), plus copy/edit behavior.
- `people-registry`: Person records with an Admin-configurable card schema, recruitment anchoring, plan assignment (as a template copy), and progress recording.
- `data-ingestion`: Agent-assisted person creation from a PDF (draft extraction → human review → human commit; manual fallback).
- `evaluations-and-events`: The per-person evaluations & events page (structured recurring slots + free-form; text + files).
- `gap-engine`: Two-axis gap computation, gap states, and rollup dashboards at any org level.
- `agent-rules-engine`: Per-user verbal rules, one-time/chronic execution, results page, and pin-to-deterministic (script or locked flow), with drift-detection permitted for the future.
- `agent-qa-chat`: Interactive read-only Q&A over structured and unstructured data, with mandatory evidence, stateless in this version.

### Modified Capabilities
<!-- Greenfield project — no existing specs to modify. -->

## Impact

- **Greenfield**: this proposal defines the whole system. Tech stack, storage, and the agent runtime/scheduler are not yet chosen (see design's Open Questions).
- **Central invariant (refined)**: the agent has **no autonomous write authority**. It reads within scope and *proposes* (a rendered document, or a pre-filled draft); every write to source-of-truth data is a human action. This removes agent write-permissions and mutation-auditing from scope.
- **Phased implementation**: the *data half* (`access-control`, `org-structure`, `career-plans`, `people-registry`, `evaluations-and-events`, `gap-engine`) precedes the *agent half* (`data-ingestion` assist, `agent-rules-engine`, `agent-qa-chat`).
- **Localization**: primary UI language is Hebrew (RTL); domain vocabulary is Hebrew.
- **Deferred / open**: tech stack & file storage, person-card field types + validation, PDF partial-match behavior, the 🟡 approaching-window / grace threshold, and the agent runtime/scheduler.
