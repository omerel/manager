## ADDED Requirements

### Requirement: Dates are written and read as Israeli dates

Every date the user types SHALL be entered as `dd/mm/yyyy`, and the system SHALL interpret a numeric date **only** as day-first. The month-first (American) reading SHALL NOT be applied anywhere — not as a primary reading, not as a fallback when the day-first reading fails, and not for a value where both readings are numerically possible.

The entry format SHALL be the same on every machine, and SHALL NOT depend on the browser's or operating system's locale.

A value that cannot be read as a valid calendar date SHALL be refused. The system SHALL NOT store, propose or display a date it did not parse unambiguously.

Machine-to-machine interfaces — the backup bundle and the data handed to the agent — SHALL continue to use ISO `yyyy-mm-dd`, which has no reading to get wrong.

#### Scenario: Entering a date

- **WHEN** a user types `03/08/2026` into any date field
- **THEN** the date is stored as 3 August 2026, never as 8 March

#### Scenario: The same on every machine

- **WHEN** the application is opened on a machine whose locale is US English
- **THEN** date fields still show and accept `dd/mm/yyyy`

#### Scenario: An impossible date

- **WHEN** a user enters `31/02/2026`
- **THEN** it is refused rather than rolled forward into March

#### Scenario: A malformed date is not stored

- **WHEN** a date that cannot be parsed reaches a server action
- **THEN** the action refuses it rather than storing a guess

#### Scenario: Backups stay machine-readable

- **WHEN** a backup bundle is exported
- **THEN** its dates are ISO, so re-importing them cannot depend on a reading convention

## MODIFIED Requirements

### Requirement: Configurable person-card field schema

The set of personal-detail fields on a person's card SHALL be a schema defined by the Admin (מנהלן), not a fixed form. This schema also defines the "required fields" that agent-assisted PDF ingestion attempts to extract. Recruitment date SHALL always be part of the schema because it anchors the plan timeline.

Where the schema page tells the Admin which fields are fixed and therefore not theirs to define, that list SHALL match the fields the person form actually renders, and SHALL be stated once so the page cannot present two different lists. A field the Admin is told is fixed but is not shown, or is shown but not named, misinforms the only decision the page exists to support: what still needs adding.

A field of type DATE SHALL be entered and displayed under the same Israeli date rules as every other date in the system.

#### Scenario: Admin defines the card schema

- **WHEN** the Admin defines the person-card fields (e.g. name, ID, recruitment date, education, specialty)
- **THEN** those fields become the structure of every person's card and the target field set for ingestion

#### Scenario: Recruitment date is mandatory in the schema

- **WHEN** the Admin configures the person-card schema
- **THEN** the schema SHALL always include recruitment date, since plan offsets anchor to it

#### Scenario: The fixed fields are named accurately

- **WHEN** the Admin opens the card-schema page
- **THEN** the fixed core fields are named as the person form renders them — first name and last name separately, date of birth, recruitment date, employment status and end-of-service date — together with the placement, photo and career plan that every person carries

#### Scenario: The page states the fixed fields once

- **WHEN** the card-schema page names the fixed fields in more than one place
- **THEN** every occurrence derives from the same list and they cannot disagree

#### Scenario: A custom date field

- **WHEN** a person's custom field of type DATE is filled in
- **THEN** it is entered as `dd/mm/yyyy` and read day-first, like every other date
