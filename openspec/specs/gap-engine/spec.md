# gap-engine

## Purpose

מנוע פערים דו-צירי (זמן × ערך) הנגזר מ(היום, תכנית, התקדמות); מצבים ⬜🟡🔴 ודשבורד rollup בכל רמת עץ.

## Requirements

### Requirement: Gap computation across time and value axes

The system SHALL compute a person's gaps as a function of today's date, their assigned plan, and their recorded progress, evaluated across two axes: **time** (on-time vs. late relative to the recruitment-anchored date) and **value** (target reached vs. short, for cumulative metrics). Gap evaluation MUST be derived, not manually set.

#### Scenario: On-time and complete

- **WHEN** a point event is done on or before its anchored date
- **THEN** its gap state SHALL be 🟢 (met)

#### Scenario: Short on a cumulative target

- **WHEN** a metric target of 300 hours is due and the person has 247
- **THEN** the system SHALL report a value gap of 53 hours

### Requirement: Gap states

The system SHALL classify each plan item into gap states: ⬜ future (date not yet reached), 🟡 approaching or in-progress, and 🔴 overdue-and-short / missed. A missed point event and an unfilled recurring occurrence past its date SHALL both resolve to 🔴.

#### Scenario: Approaching state

- **WHEN** an item's anchored date is within the approaching window and it is not yet met
- **THEN** its state SHALL be 🟡

#### Scenario: Unfilled recurring occurrence is a gap

- **WHEN** a recurring evaluation occurrence's date has passed and no content was filed
- **THEN** its state SHALL be 🔴 and it SHALL count as a gap in rollups

### Requirement: Gap prominence on the person card

The system SHALL surface a person's gaps prominently on their individual card so that time and value gaps are immediately visible.

#### Scenario: Viewing a person with gaps

- **WHEN** a manager opens a person who is 🔴 on two items
- **THEN** the card SHALL make those gaps visually prominent

### Requirement: Rollup gap dashboard

The system SHALL provide a rollup dashboard that reports gap counts at any level of the org tree (team, section, domain, center), with the ability to drill from an aggregate into the underlying people. The dashboard SHALL present compliance visually: a compliance gauge, a per-framework comparison, and a needs-attention list of the people in gap state. The org tree SHALL be **collapsible**: each framework can be collapsed or expanded individually, and a single control SHALL collapse or expand all team-level nodes at once (teams being where individual people are listed).

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

### Requirement: Recurring occurrences come only from the plan, clipped by departure

The set of occurrences a person is measured against SHALL be derived solely from the recurring event's interval and its stop month in the plan. The system SHALL NOT apply any implicit horizon when a stop month is absent. When a person has an end-of-service date, their occurrences SHALL additionally be clipped at that date, for every recurring event regardless of how it is defined, so someone who has left does not accumulate overdue occurrences.

#### Scenario: No implicit horizon

- **WHEN** a recurring event has no stop month recorded
- **THEN** the system SHALL produce no occurrences for it and make that visible, rather than substituting a default number of months

#### Scenario: Departure clips the schedule

- **WHEN** a person with an end-of-service date at month 10 is assigned a recurring event that stops at month 24
- **THEN** occurrences after month 10 SHALL NOT be expected of them and SHALL NOT count as gaps

#### Scenario: No departure date recorded

- **WHEN** a person has no end-of-service date
- **THEN** their occurrences run to the plan's stop month, unchanged by the absence of that date

#### Scenario: Two people, one plan

- **WHEN** two serving people with no departure date are assigned the same plan
- **THEN** they are measured against exactly the same occurrences
