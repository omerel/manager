## Context

The single-file pipeline is complete and battle-tested: `extractForNewPerson` stages the upload, runs a background `AgentRun` (kind `EXTRACT`, guarded to one live run per user), materializes text with OCR fallback, calls the agent, and lands either a `PersonDraft` (new person) or `ExtractionProposal` rows (existing person, via `extractFromDocument`). Review UIs exist for both: `/people/new?draft=` prefilled form, and the per-field approval panel on the person card. `/people/new` polls with an `AutoRefresh` component while a job is live.

`AgentRun.kind` is a plain string column — a new kind costs nothing. `AgentRun.output` is a free string (today: the draft id).

What does not exist: accepting N files, running them concurrently without tripping the single-flow guard, deciding create-vs-update per file, and a place to watch the batch.

## Goals / Non-Goals

**Goals:**

- N files dropped once; each becomes an independent job whose failure is its own.
- Create-vs-update decided by exact full-name match, so one drop serves both cohort onboarding and file refreshes.
- Every ready item reviewable the moment it is ready; approval stays per-item and human.

**Non-Goals:**

- Bulk approval. The whole point of the review step is a human reading each card; an "accept all" button would delete it.
- Fuzzy name matching. Wrong-person updates are worse than duplicate drafts; only exact equality matches (user's decision).
- Progress streaming/websockets. `AutoRefresh` polling is already the house pattern and is enough for a queue measured in single minutes.
- Touching the single-file flow.

## Decisions

### 1. A new run kind, `INTAKE`, not a loosened guard

The `EXTRACT` guard (one live run per user) protects the single-flow UX, where the page tracks "the" run. Bulk runs get kind `INTAKE` so both guards stay simple: the single flow keeps its one-run invariant untouched, and the intake page queries its own kind. No schema change — `kind` is a string.

*Alternative — parameterize the guard.* Touches the working single flow to serve the new one. Rejected.

### 2. Fan-out with a small concurrency cap, staged before the action returns

The action stages **all** files to temp dirs synchronously (uploads die with the request), then returns while a runner works through them at most 3 at a time. Each file is its own `AgentRun` created up front in `RUNNING` state — so the queue shows every file immediately, including the ones still waiting for a slot. The cap exists because each job may spawn an agent CLI process; N=20 files must not mean 20 concurrent processes on an air-gapped box.

### 3. Match → proposal; no match or ambiguous → draft

Per file, after extraction: compose the extracted full name (the same first+last composition the person form uses), trim, and count exact `fullName` matches among existing people.

- **Exactly one** → `ExtractionProposal` rows on that person (the existing mechanism), run linked via `personId`.
- **Zero or more than one** → `PersonDraft`. Ambiguity deliberately falls to *draft*, not to "pick one": with two אבי כהן in the registry, proposing field changes onto either is a coin-flip on someone's record. A duplicate draft is visibly redundant at review; a wrong update is silently destructive.

The run's `output` records the destination as `draft:<id>` or `person:<id>` — greppable, and enough for the queue to build the review link.

### 4. The queue is a section over `AgentRun`, not a new table

Rendered directly ON `/people` for the admin (first shipped as a separate `/people/intake` page behind a link — and the admin dropped files on the people list itself, where nothing caught them; the request said "בעמוד אנשים" and meant it literally; the old URL now redirects): a multi-`FileDrop` form plus the user's recent `INTAKE` runs — filename from `prompt`, state from the existing `effectiveStatus` (RUNNING / SUCCEEDED / FAILED, with the stale-run timeout), and per ready item a link: draft → `/people/new?draft=<id>`, proposal → `/people/<id>`. `AutoRefresh` mounts while any run is live. No new persistence: the runs *are* the batch state, survive navigation, and expire from attention naturally the way other jobs do.

"Reviewable as ready" falls out for free: each link works the moment its run succeeds, because the review artifacts are the same ones the single flow produces.

### 5. Admin-only at both layers

The request scopes bulk intake to the admin. The page checks `isAdmin` for rendering; the action calls `requireAdmin()` — the action being the real gate, as with the delete actions.

## Risks / Trade-offs

- **N staged temp dirs if the process dies mid-batch** → each job cleans its own dir in `finally` (existing pattern); dirs of jobs that never started are orphaned tmpdirs the OS reaps. Accepted.
- **The extracted name is wrong → misrouted file** → exact-match-only narrows this to "extracted name exactly equals a different real person", and the per-field review screen names the person before anything is applied. The human step is the backstop, by design.
- **Two files in one batch for the same new person** → two drafts; visible at review, merged by the admin approving one and discarding the other. Not worth pre-deduplicating.
- **A batch dropped twice** → same as above at scale: duplicate drafts/proposals, all inert until approved. The queue showing recent runs makes the double-drop visible immediately.
- **Agent CLI absent/misconfigured** → every job fails with the run's error string shown per file in the queue — the batch degrades to N legible failures, not a hang (the stale-run timeout already covers the hang case).

## Migration Plan

None. No schema change; a new page and actions. Rollback = revert.

## Open Questions

None — placement (people page entry), matching rule, and per-item approval were settled with the user.
