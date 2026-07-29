## ADDED Requirements

### Requirement: Configurable person-card field schema

The set of personal-detail fields on a person's card SHALL be a schema defined by the Admin (מנהלן), not a fixed form. This schema also defines the "required fields" that agent-assisted PDF ingestion attempts to extract. Recruitment date SHALL always be part of the schema because it anchors the plan timeline.

#### Scenario: Admin defines the card schema

- **WHEN** the Admin defines the person-card fields (e.g. name, ID, recruitment date, education, specialty)
- **THEN** those fields become the structure of every person's card and the target field set for ingestion

#### Scenario: Recruitment date is mandatory in the schema

- **WHEN** the Admin configures the person-card schema
- **THEN** the schema SHALL always include recruitment date, since plan offsets anchor to it

### Requirement: Person record and personal details

The system SHALL store a person record whose personal-detail fields follow the Admin-defined card schema, and which always includes: recruitment date, employment status (active / planned-end-date / departed), and organizational placement (team, resolving to section/domain/center). The recruitment date SHALL act as the anchor that converts a plan's relative offsets into calendar dates for that person.

#### Scenario: Creating a person

- **WHEN** an edit-level Manager creates a person with a recruitment date and team placement
- **THEN** the system SHALL store the record and resolve their org path from the team

#### Scenario: Recruitment date anchors the plan

- **WHEN** a person with recruitment date 2026-03-01 is assigned a plan containing an event at +9 months
- **THEN** the system SHALL compute that event's calendar date as 2026-12-01

### Requirement: Employment status governs recurrence

The system SHALL use the person's employment status and end-of-service to bound recurring-event unrolling and to determine whether the person is active for gap reporting.

#### Scenario: End of service stops recurrence

- **WHEN** a person's end-of-service date is set
- **THEN** recurring-event occurrences SHALL not be generated beyond that date

### Requirement: Plan assignment as a template copy

When a plan is assigned to a person, the system SHALL assign a **copy** of the template so that later edits to the template do not retroactively alter the person's assigned plan.

#### Scenario: Assigning a plan

- **WHEN** a manager assigns template plan A to a person
- **THEN** the person receives an independent copy, and subsequent edits to template A do not change the person's plan

### Requirement: Recording actual progress

The system SHALL let a manager record a person's actual progress against their assigned plan: marking point events done (with a date), and recording the current value of cumulative metrics (with an as-of date).

#### Scenario: Marking a point event done

- **WHEN** a manager marks "finish basic training" as done for a person
- **THEN** the system SHALL store the completion and its date

#### Scenario: Recording a metric value

- **WHEN** a manager records 247 grant-hours for a person as of a given date
- **THEN** the system SHALL store the actual accumulated value for comparison against plan targets
