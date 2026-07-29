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

The system SHALL provide a rollup dashboard that reports gap counts at any level of the org tree (team, section, domain, center), with the ability to drill from an aggregate into the underlying people.

#### Scenario: Dashboard at domain level

- **WHEN** a manager views the dashboard for a domain
- **THEN** the system SHALL show the domain's aggregate gap counts and allow drilling down into sections, teams, and individual people in gap state
