## ADDED Requirements

### Requirement: Unit placement date

The system SHALL store, for every person, the date they were placed in this unit (תאריך הצבה ביחידה), required alongside the recruitment date. This date SHALL be the origin of the person's career-plan timeline; the recruitment date SHALL remain part of the record as their history, and SHALL NOT anchor plan offsets.

A person whose placement date is not known SHALL be given their recruitment date, which is the assumption the system made implicitly before the field existed. Both dates SHALL be visible on the person's card, so that a plan date differing from what the recruitment date would imply has a visible cause.

#### Scenario: Creating a person

- **WHEN** a Manager creates a person
- **THEN** a unit placement date is required, and the plan timeline for that person is measured from it

#### Scenario: Existing people when the field is introduced

- **WHEN** the placement date is introduced to a registry of people who have none
- **THEN** each receives their recruitment date, and every computed plan date and gap stays exactly as it was

#### Scenario: Someone who arrived after serving elsewhere

- **WHEN** a person recruited three years ago was placed in this unit one year ago
- **THEN** their plan's month offsets resolve from the placement date, so an event at +12 months falls one year after they arrived, not two years before

#### Scenario: Both dates are shown

- **WHEN** a person's placement date differs from their recruitment date
- **THEN** the person's card shows both, rather than presenting one date as if it explained the plan's schedule

## MODIFIED Requirements

### Requirement: Person record and personal details

The system SHALL store a person record whose personal-detail fields follow the Admin-defined card schema, and which always includes: **first name and last name as separate fields**, **date of birth**, recruitment date, **unit placement date**, employment status (active / planned-end-date / departed), and organizational placement (team, resolving to section/domain/center). The **unit placement date** SHALL act as the anchor that converts a plan's relative offsets into calendar dates for that person. Date of birth SHALL be required when creating a person; **age SHALL be derived from it and displayed in years and months**, never stored and never manually editable.

The end-of-service field SHALL be named with the term the organisation uses — תאריך סיום שירות (תת״ש) — in the person form and in the field set offered to document extraction, so that a document using that term is matched.

#### Scenario: Creating a person

- **WHEN** an edit-level Manager creates a person with first name, last name, date of birth, recruitment date, unit placement date and team placement
- **THEN** the system SHALL store the record and resolve their org path from the team

#### Scenario: Age is derived

- **WHEN** a person's date of birth is known
- **THEN** the card shows their age in years and months, computed from today, with no way to edit it directly

#### Scenario: Birth date required on new records

- **WHEN** a Manager submits a new person without a date of birth
- **THEN** the system SHALL reject the submission

#### Scenario: Placement date anchors the plan

- **WHEN** a person placed in the unit on 2026-03-01 is assigned a plan containing an event at +9 months
- **THEN** the system SHALL compute that event's calendar date as 2026-12-01, regardless of when they were recruited

#### Scenario: A document naming תת״ש

- **WHEN** a document is extracted that gives an end-of-service date under the term תת״ש
- **THEN** the field is recognised and proposed like any other
