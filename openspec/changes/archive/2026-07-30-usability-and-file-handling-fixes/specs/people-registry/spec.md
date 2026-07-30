## MODIFIED Requirements

### Requirement: Person record and personal details

The system SHALL store a person record whose personal-detail fields follow the Admin-defined card schema, and which always includes: **first name and last name as separate fields**, **date of birth**, recruitment date, employment status (active / planned-end-date / departed), and organizational placement (team, resolving to section/domain/center). The recruitment date SHALL act as the anchor that converts a plan's relative offsets into calendar dates for that person. Date of birth SHALL be required when creating a person; **age SHALL be derived from it and displayed in years and months**, never stored and never manually editable.

#### Scenario: Creating a person

- **WHEN** an edit-level Manager creates a person with first name, last name, date of birth, recruitment date and team placement
- **THEN** the system SHALL store the record and resolve their org path from the team

#### Scenario: Recruitment date anchors the plan

- **WHEN** a person with recruitment date 2026-03-01 is assigned a plan containing an event at +9 months
- **THEN** the system SHALL compute that event's calendar date as 2026-12-01

#### Scenario: Age is derived

- **WHEN** a person's date of birth is known
- **THEN** the card shows their age in years and months, computed from today, with no way to edit it directly

#### Scenario: Birth date required on new records

- **WHEN** a Manager submits a new person without a date of birth
- **THEN** the system SHALL reject the submission

## ADDED Requirements

### Requirement: Enlarging a person's photo

Clicking a person's profile photo SHALL open it enlarged in a centered overlay above the page, dismissible by the user.

#### Scenario: Viewing a photo

- **WHEN** a user clicks the photo on a person's card
- **THEN** the photo is shown enlarged and centered over the page, and can be closed to return to the card
