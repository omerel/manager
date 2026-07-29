## ADDED Requirements

### Requirement: Read-only agent boundary; no autonomous write

The agent SHALL have no autonomous write authority over manager-owned data: it MAY read any career data (org, plans, people, progress, evaluations, gaps) within the invoking user's scope and MUST NOT create, update, or delete that data on its own. For rules, its only outputs are rendered documents, files, and system reports. Any mutation of source-of-truth data is always a human action (see data-ingestion for the draft-then-human-commit pattern).

#### Scenario: Agent attempts no mutation

- **WHEN** a rule's intent would imply changing a person's data (e.g. "mark everyone's training done")
- **THEN** the agent SHALL still only produce a report/document and SHALL NOT modify any record

### Requirement: Per-user verbal rules

Each user SHALL have their own rules page on which they author rules in natural language. A rule describes a read-only task over career data that produces an output.

#### Scenario: Authoring a rule

- **WHEN** a user writes a rule "each month, list everyone in my domain behind on grant hours and draft a reminder per team lead"
- **THEN** the system SHALL store the rule under that user's rules page

### Requirement: One-time and chronic execution

A rule SHALL be runnable either one-time (on demand) or chronically on a schedule defined by the user (e.g. monthly, quarterly). Each run SHALL produce its output on a dedicated results page as a document or file.

#### Scenario: One-time run

- **WHEN** a user triggers a rule once
- **THEN** the agent SHALL execute it and place the resulting document/file on the results page

#### Scenario: Chronic run

- **WHEN** a rule is scheduled monthly
- **THEN** the system SHALL run it on that cadence and append each run's output to the results page

### Requirement: Pin a rule to deterministic reproduction

After a user approves a specific output of a rule, the system SHALL allow the rule to be **pinned** so that future runs faithfully reproduce the approved output's style and format. "Deterministic" here means fidelity to the approved output ("golden example"), not necessarily elimination of the LLM. The agent SHALL choose the realization based on what it judges it can faithfully reproduce: either a deterministic script (for computational rules) or a locked flow — a precise procedure plus style/format template the generation must follow (for generative rules).

#### Scenario: Pinning a computational rule

- **WHEN** a user approves the output of a purely computational rule and pins it
- **THEN** the agent MAY compile it to a deterministic script that reproduces the output 1:1 on future runs

#### Scenario: Pinning a generative rule

- **WHEN** a user approves the output of a rule that requires generated prose and pins it
- **THEN** the agent SHALL store a locked flow (procedure + style/format template) plus the approved output as a golden example to imitate and check against

#### Scenario: Agent selects the realization

- **WHEN** a rule is pinned
- **THEN** the agent SHALL decide between script and locked flow based on its own assessment of faithful reproducibility, without requiring the user to choose the mechanism

### Requirement: Drift detection allowed (future-permitting)

The model SHALL permit — without requiring in the first version — detecting when a pinned rule's output drifts from its golden example (e.g. due to data-shape or org changes) and flagging it for the user to re-pin.

#### Scenario: Drift flagged for review

- **WHEN** a pinned rule runs and its output diverges materially from the golden example
- **THEN** the system MAY flag the rule as drifted and prompt the user to review and re-pin, rather than silently publishing the divergent output
