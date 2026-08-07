## MODIFIED Requirements

### Requirement: Configurable person-card field schema

The set of personal-detail fields on a person's card SHALL be a schema defined by the Admin (מנהלן), not a fixed form. This schema also defines the "required fields" that agent-assisted PDF ingestion attempts to extract. Recruitment date SHALL always be part of the schema as the person's service history; it is not what plan offsets resolve through — the unit placement date is the plan anchor.

Where the schema page tells the Admin which fields are fixed and therefore not theirs to define, that list SHALL match the fields the person form actually renders, and SHALL be stated once so the page cannot present two different lists. A field the Admin is told is fixed but is not shown, or is shown but not named, misinforms the only decision the page exists to support: what still needs adding.

A field of type DATE SHALL be entered and displayed under the same Israeli date rules as every other date in the system.

#### Scenario: Admin defines the card schema

- **WHEN** the Admin defines the person-card fields (e.g. name, ID, recruitment date, education, specialty)
- **THEN** those fields become the structure of every person's card and the target field set for ingestion

#### Scenario: Recruitment date is mandatory in the schema

- **WHEN** the Admin configures the person-card schema
- **THEN** the schema SHALL always include recruitment date as service history, while plan offsets continue to resolve through the unit placement date alone

#### Scenario: The fixed fields are named accurately

- **WHEN** the Admin opens the card-schema page
- **THEN** the fixed core fields are named as the person form renders them — first name and last name separately, date of birth, recruitment date, employment status and end-of-service date — together with the placement, photo and career plan that every person carries

#### Scenario: The page states the fixed fields once

- **WHEN** the card-schema page names the fixed fields in more than one place
- **THEN** every occurrence derives from the same list and they cannot disagree

#### Scenario: A custom date field

- **WHEN** a person's custom field of type DATE is filled in
- **THEN** it is entered as `dd/mm/yyyy` and read day-first, like every other date
