## Why

Every agent-backed operation today blocks the browser until it finishes: a chat question (~20–60s), a rule run, a document extraction (~30–60s), and worst of all pinning (up to several minutes). The spinner buttons we added tell the user *something* is happening, but the page is frozen the whole time — you can't navigate, a closed tab loses the visual result, and a slow pin feels broken. Long operations should run in the background while the UI shows live progress and updates itself when done.

## What Changes

- **Background execution** — long actions return immediately: the action records a `RUNNING` job and schedules the actual work to run after the response (Next's `after()`), in-process, no new infra. The user lands on the page right away with a progress card.
- **Live progress UI** — pages showing a `RUNNING` job auto-refresh every few seconds until it completes, then render the result in place (answer / report / pin panel / extraction proposals). Navigating away and coming back later shows the finished result.
- **All four operation types converted**:
  - **Chat question** — redirect to `?run=…` immediately; "הסוכן חושב…" card until the answer appears.
  - **Rule run** — results page shows the running entry live.
  - **Pin** — tracked as a job; the rule page shows "מקבע…" and flips to the pinned panel when done (this is the operation where blocking hurt most).
  - **Document extraction** (person edit + new-person) — page returns at once; the panel shows "מנתח…" and the proposals/pre-filled form appear on completion.
- **Duplicate-run guard** — while a job is `RUNNING` for a given target (same rule, same person extraction, same user's pin), starting another is blocked with a clear message.
- **Job records unified on `AgentRun`** — extended with new kinds (`PIN`, `EXTRACT`) and an optional person link, so every long operation has one queryable status row.

## Capabilities

### New Capabilities
- `async-operations`: Background execution of long-running agent operations with immediate response, live-updating progress UI, persistence of results across navigation, and duplicate-run guarding.

### Modified Capabilities
<!-- None at requirement level: agent-qa-chat / agent-rules-engine / data-ingestion specs
     define WHAT the operations produce, not the blocking execution model. -->

## Impact

- **Code**: `AgentRun` schema extension (kinds + optional `personId`), a small `runInBackground` helper (`after()`), an `AutoRefresh` client component, and edits to the chat/rules/extraction actions + their pages. `PendingButton` stays for the brief submit moment.
- **Architecture constraint**: background work runs in the Next server process — fits the current single-instance deployment (the agent already shells out to the local `claude` CLI); a serverless/multi-instance deployment would need a real queue (out of scope, noted in design).
- **Behavior**: no more frozen pages; closed tabs no longer "lose" a running operation (it completes and is there when you return).
