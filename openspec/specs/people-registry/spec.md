# people-registry

## Purpose

מרשם אנשים: כרטיס בסכימה ניתנת-להגדרה, עוגן תאריך-גיוס, שיוך תכנית כעותק עצמאי, ורישום התקדמות.

## Requirements

### Requirement: Configurable person-card field schema

The set of personal-detail fields on a person's card SHALL be a schema defined by the Admin (מנהלן), not a fixed form. This schema also defines the "required fields" that agent-assisted PDF ingestion attempts to extract. Recruitment date SHALL always be part of the schema because it anchors the plan timeline.

#### Scenario: Admin defines the card schema

- **WHEN** the Admin defines the person-card fields (e.g. name, ID, recruitment date, education, specialty)
- **THEN** those fields become the structure of every person's card and the target field set for ingestion

#### Scenario: Recruitment date is mandatory in the schema

- **WHEN** the Admin configures the person-card schema
- **THEN** the schema SHALL always include recruitment date, since plan offsets anchor to it

### Requirement: Person record and personal details

The system SHALL store a person record whose personal-detail fields follow the Admin-defined card schema, and which always includes: **first name and last name as separate fields**, **date of birth**, recruitment date, employment status (active / planned-end-date / departed), and organizational placement (team, resolving to section/domain/center). The recruitment date SHALL act as the anchor that converts a plan's relative offsets into calendar dates for that person. Date of birth SHALL be required when creating a person; **age SHALL be derived from it and displayed in years and months**, never stored and never manually editable.

#### Scenario: Creating a person

- **WHEN** an edit-level Manager creates a person with first name, last name, date of birth, recruitment date and team placement
- **THEN** the system SHALL store the record and resolve their org path from the team

#### Scenario: Age is derived

- **WHEN** a person's date of birth is known
- **THEN** the card shows their age in years and months, computed from today, with no way to edit it directly

#### Scenario: Birth date required on new records

- **WHEN** a Manager submits a new person without a date of birth
- **THEN** the system SHALL reject the submission

#### Scenario: Recruitment date anchors the plan

- **WHEN** a person with recruitment date 2026-03-01 is assigned a plan containing an event at +9 months
- **THEN** the system SHALL compute that event's calendar date as 2026-12-01

### Requirement: Employment status governs recurrence

The system SHALL use the person's employment status and end-of-service to bound recurring-event unrolling and to determine whether the person is active for gap reporting.

#### Scenario: End of service stops recurrence

- **WHEN** a person's end-of-service date is set
- **THEN** recurring-event occurrences SHALL not be generated beyond that date

### Requirement: Plan assignment as a template copy

When a plan is assigned to a person, the system SHALL assign a **copy** of the template so that later edits to the template do not retroactively alter the person's assigned plan. A person SHALL have at most one active assignment at a time, and every assignment they have ever had SHALL be retained as a record of the period it covered.

#### Scenario: Assigning a plan

- **WHEN** a manager assigns template plan A to a person
- **THEN** the person receives an independent copy, and subsequent edits to template A do not change the person's plan

#### Scenario: One active plan

- **WHEN** a person is assigned a new plan while they already have one
- **THEN** the earlier assignment is ended rather than removed, and only the new one is active

### Requirement: Recording actual progress

The system SHALL let a manager record a person's actual progress against their assigned plan: marking point events done (with a date), and recording the current value of cumulative metrics (with an as-of date).

#### Scenario: Marking a point event done

- **WHEN** a manager marks "finish basic training" as done for a person
- **THEN** the system SHALL store the completion and its date

#### Scenario: Recording a metric value

- **WHEN** a manager records 247 grant-hours for a person as of a given date
- **THEN** the system SHALL store the actual accumulated value for comparison against plan targets

### Requirement: Enlarging a person's photo

Clicking a person's profile photo SHALL open it enlarged in a centered overlay above the page, dismissible by the user.

#### Scenario: Viewing a photo

- **WHEN** a user clicks the photo on a person's card
- **THEN** the photo is shown enlarged and centered over the page, and can be closed to return to the card

### Requirement: Replacing a person's photo takes effect immediately

When a person's profile photo is uploaded or replaced, the new image SHALL be displayed everywhere that person's photo appears — their card and the people list — without the user reloading, clearing the browser cache, or waiting for a cache window to expire. A previously displayed image SHALL NOT be shown once it has been replaced.

#### Scenario: Replacing an existing photo

- **WHEN** an edit-level Manager uploads a new photo for a person who already has one
- **THEN** the person's card shows the new photo immediately after the upload completes

#### Scenario: The list reflects the change too

- **WHEN** the photo has been replaced
- **THEN** the person's avatar in the people list shows the new photo, not the previous one

#### Scenario: Reloading never shows the old image

- **WHEN** the user reloads any page showing that person after the replacement
- **THEN** the new photo is displayed, with no dependence on a hard refresh or on elapsed time

### Requirement: A replaced photo file is not retained

Uploading a replacement photo SHALL remove the file it replaced from storage, so repeated replacements do not accumulate unreferenced files on the uploads volume. Failure to remove the old file SHALL NOT fail the upload.

#### Scenario: Replacing a photo several times

- **WHEN** a person's photo is replaced repeatedly
- **THEN** only the current photo remains in storage for that person

#### Scenario: Removal fails

- **WHEN** the previous file cannot be deleted
- **THEN** the upload still succeeds and the new photo is the one displayed

### Requirement: A person's plan history is visible on their card

A person's card SHALL show the plans they have been assigned over time — for each, the period it covered, the reason recorded for leaving it, and what was achieved and left unmet during it. Waived items of the active plan SHALL be shown and marked rather than hidden, so that an item not counted as a gap can be told apart from one that is simply absent.

#### Scenario: Viewing a person who has transferred

- **WHEN** a Manager opens the card of a person who has moved between plans
- **THEN** the previous plans are listed with their periods, and each shows what was completed and what was left unmet

#### Scenario: A waived item is visible

- **WHEN** the active plan contains an item waived because it predates the assignment
- **THEN** the item is displayed with a mark identifying it as waived, not omitted from the plan
