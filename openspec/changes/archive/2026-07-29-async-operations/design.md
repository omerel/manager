## Context

All four agent operations follow the same synchronous shape today: server action → run `claude -p` (or the pinned script) to completion → write the result → redirect. `AgentRun` already records `RUNNING → SUCCEEDED/FAILED` for chat and rule runs — the async model is latent in the data; only the execution and the UI need to change. Pinning and extraction currently have no job record at all (pin mutates `Rule` at the end; extraction writes `ExtractionProposal`/`PersonDraft` at the end).

## Goals / Non-Goals

**Goals:**
- Immediate response on every long action; results appear via self-refreshing pages.
- One job model (`AgentRun`) for all four operation kinds; progress states readable from it.
- Survive navigation/tab-close; guard duplicate concurrent runs.
- Zero new infrastructure (no queue, no websockets, no worker process).

**Non-Goals:**
- Multi-instance/serverless-safe job queue (current deployment is single-instance Node with a local `claude` CLI; a real queue is a future change).
- Job cancellation, retries, or progress percentages.
- Push updates (SSE/websockets) — polling refresh is sufficient at this scale.

## Decisions

**D1 — Background execution via Next `after()` in-process.**
The action creates the RUNNING `AgentRun`, calls `after(() => execute(...))`, and redirects. `after()` runs the work once the response is sent, in the same Node process that already shells out to `claude`. *Why:* idiomatic Next 16, no infra, works with the existing engines untouched. *Alternative rejected:* a job queue (BullMQ/pg-boss) — real machinery for a constraint we don't have yet; noted as the upgrade path for multi-instance deployments.

**D2 — `AgentRun` is the universal job record.**
Extend `kind` to `CHAT | RULE | PIN | EXTRACT` and add optional `personId` (extraction target; `ruleId` already exists). Pin success writes the realization to the `Rule` inside the job; extraction success writes the `ExtractionProposal`/`PersonDraft` and stores the draft id in `run.output` so the new-person page can pick it up. *Why:* one table to poll, one shape for progress cards, and history for free.

**D3 — Polling via an `AutoRefresh` client component, no push.**
Pages that render a RUNNING job also render `<AutoRefresh ms={3000}/>`, which calls `router.refresh()` on an interval; when the job leaves RUNNING the server render stops including the component, so polling stops naturally. A generous cap (~10 min of polling) avoids immortal timers. *Why:* server components stay the source of truth; ~3s latency is imperceptible next to 30s+ runs.

**D4 — Duplicate-run guard at job creation.**
Before creating a job: same `ruleId` (RULE/PIN) RUNNING → refuse; same `personId` EXTRACT RUNNING → refuse; same user new-person EXTRACT RUNNING → refuse. Refusal = redirect back with a "כבר רץ" notice (no error page). Buttons also disable when the page already shows a RUNNING job. *Why:* `after()` gives no dedup; the DB check is cheap and also covers double-submits.

**D5 — Stale-job hygiene.**
A RUNNING job older than the engine timeout (~10 min) is treated as FAILED ("הריצה נקטעה") when pages read it — covers server restarts mid-job, which in-process execution can't survive. *Why:* without this, a crash leaves an eternal spinner and the duplicate-guard wedges the target forever.

## Risks / Trade-offs

- **Server restart kills in-flight jobs** (dev HMR restarts especially) → D5 marks them failed and unblocks the target; user re-runs. Acceptable without a persistent queue.
- **`after()` work shares the server process** → heavy runs already did (synchronously); concurrency is naturally limited by the few users. The claude CLI serializes nothing itself — unchanged from today.
- **Polling every 3s per waiting page** → trivial load (one DB read per tick), stops automatically.
- **Extraction results flow changes** (proposal appears via refresh rather than redirect-after-work) → the `?extract=none` empty-result signal moves onto the job record (FAILED-with-message or empty output → panel shows "לא נמצאו ערכים").

## Migration Plan

1. Schema: extend `AgentRun.kind` values + optional `personId` (additive migration).
2. Add `runInBackground` helper + `AutoRefresh` component + stale-job util.
3. Convert operations one at a time — chat → rule run → pin → extraction — each keeping its page rendering the same final states as today.
4. Verify with headless-browser tests (immediate return, auto-appearing result, duplicate guard, stale-job failure).
No data migration; existing runs remain valid.

## Open Questions

- Poll interval 3s vs adaptive (3s → 10s after a minute) — start fixed 3s, tune if noisy.
- Should the rules list page also show a "running" badge live? (Nice-to-have; cheap once jobs are unified.)
