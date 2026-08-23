# gap-engine — delta

## MODIFIED Requirements

### Requirement: Rollup gap dashboard

The system SHALL provide a rollup dashboard that reports gap counts at any level of the org tree (team, section, domain, center), with the ability to drill from an aggregate into the underlying people. The dashboard SHALL present compliance visually: a compliance gauge, a per-framework comparison, and a needs-attention list of the people in gap state. The org tree SHALL be **collapsible**: each framework can be collapsed or expanded individually, and a single control SHALL collapse or expand all team-level nodes at once (teams being where individual people are listed). Where a framework has a commander appointed, the tree SHALL label the framework with the commander's name.

#### Scenario: Dashboard at domain level

- **WHEN** a manager views the dashboard for a domain
- **THEN** the system SHALL show the domain's aggregate gap counts and allow drilling down into sections, teams, and individual people in gap state

#### Scenario: Compliance shown as a gauge

- **WHEN** a manager opens the dashboard
- **THEN** the compliance percentage is rendered as a visual gauge whose color reflects that high compliance is positive

#### Scenario: Comparing frameworks at a glance

- **WHEN** the manager's scope contains more than one framework
- **THEN** the dashboard shows a per-framework compliance comparison (e.g. bars), clipped to the manager's visibility

#### Scenario: Needs-attention list

- **WHEN** people in the manager's scope are in gap state
- **THEN** the dashboard lists them with their gap summary, each linking directly to the person's card

#### Scenario: Collapsing a framework

- **WHEN** a manager collapses a framework in the tree
- **THEN** its descendants are hidden while its rolled-up counts remain visible

#### Scenario: Collapsing all teams at once

- **WHEN** a manager uses the collapse-all-teams control
- **THEN** every team node collapses so its people are hidden, leaving the framework structure visible; the same control expands them again

#### Scenario: A commanded framework names its commander

- **WHEN** a user views the dashboard's org tree and a visible framework has a commander appointed
- **THEN** the commander's name appears as a label beside the framework's name, and frameworks without a commander show no such label
