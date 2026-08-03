## MODIFIED Requirements

### Requirement: Gap computation across time and value axes

The system SHALL compute a person's gaps as a function of today's date, their assigned plan, and their recorded progress, evaluated across two axes: **time** (on-time vs. late relative to the **placement-anchored** date) and **value** (target reached vs. short, for cumulative metrics). Every due date the engine compares against SHALL be derived from the person's unit placement date. Gap evaluation MUST be derived, not manually set.

#### Scenario: On-time and complete

- **WHEN** a point event is done on or before its anchored date
- **THEN** its gap state SHALL be 🟢 (met)

#### Scenario: Short on a cumulative target

- **WHEN** a metric target of 300 hours is due and the person has 247
- **THEN** the system SHALL report a value gap of 53 hours

#### Scenario: Due dates follow the placement date

- **WHEN** a person's unit placement date differs from their recruitment date
- **THEN** every due date the engine evaluates is measured from the placement date, and their gap states reflect that timeline rather than one starting at recruitment
