## ADDED Requirements

### Requirement: Long operations run in the background

Agent-backed operations that take more than a few seconds (chat questions, rule runs, pinning, document extraction) SHALL be executed in the background: the triggering action returns promptly after recording a RUNNING job, and the actual work completes independently of the originating request.

#### Scenario: Triggering returns immediately

- **WHEN** a user submits a chat question or runs a rule
- **THEN** the page responds within moments showing a running-progress state, while the operation continues in the background

#### Scenario: Closing the tab does not lose the result

- **WHEN** a user starts a long operation and navigates away or closes the tab
- **THEN** the operation still completes, and its result is visible when the user returns

### Requirement: Live progress that resolves in place

A page showing a RUNNING job SHALL indicate progress ("הסוכן חושב…" / "מקבע…" / "מנתח…") and refresh itself automatically every few seconds until the job completes, then render the result (answer, report, pinned panel, or extraction proposals) without requiring a manual reload.

#### Scenario: Chat answer appears when ready

- **WHEN** a chat question is running and the user stays on the page
- **THEN** the page updates on its own and shows the answer when the run succeeds

#### Scenario: Failure is surfaced

- **WHEN** a background job fails
- **THEN** the progress state is replaced by the error message, not left spinning forever

### Requirement: Pinning is tracked as a background job

Pinning a rule SHALL be recorded as a job with visible progress on the rule page; when it completes, the page reflects the pinned state (or the failure). While a pin job is RUNNING, the rule page SHALL indicate it.

#### Scenario: Pin in progress

- **WHEN** a user clicks "קבע כדטרמיניסטי"
- **THEN** the rule page returns immediately showing a pinning-in-progress state, and flips to the pinned panel when the realization is stored

### Requirement: Duplicate concurrent runs are guarded

The system SHALL prevent starting a second background job for the same target while one is RUNNING: the same rule (run or pin), the same person's extraction, or a new-person extraction by the same user. The user SHALL see a clear message instead of a second job.

#### Scenario: Re-running a rule mid-run

- **WHEN** a rule already has a RUNNING job and the user triggers it again
- **THEN** no new job is created and the page indicates a run is already in progress

### Requirement: Jobs are unified, queryable records

Every long operation SHALL be represented as a single job record carrying its kind, owner, optional target (rule/person), status, output or error, and timing — the same record the progress UI reads.

#### Scenario: Returning to a finished job

- **WHEN** a user opens a page whose job finished while they were elsewhere
- **THEN** the page renders the completed result directly from the job record, with no residual progress state
