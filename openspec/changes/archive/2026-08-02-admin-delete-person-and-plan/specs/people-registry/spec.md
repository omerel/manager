## MODIFIED Requirements

### Requirement: Configurable person-card field schema

The set of personal-detail fields on a person's card SHALL be a schema defined by the Admin (מנהלן), not a fixed form. This schema also defines the "required fields" that agent-assisted PDF ingestion attempts to extract. Recruitment date SHALL always be part of the schema because it anchors the plan timeline.

Where the schema page tells the Admin which fields are fixed and therefore not theirs to define, that list SHALL match the fields the person form actually renders, and SHALL be stated once so the page cannot present two different lists. A field the Admin is told is fixed but is not shown, or is shown but not named, misinforms the only decision the page exists to support: what still needs adding.

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

## ADDED Requirements

### Requirement: An admin can delete a person from the people list

The people list SHALL offer the Admin, and only the Admin, a control that deletes a person from the system. The control SHALL NOT appear for other roles, and the deletion SHALL be refused on the server when requested by a non-admin, so that hiding the control is presentation and not the protection itself.

Deletion SHALL be distinct from departure. A person who has left service is recorded through their employment status and keeps their record; deleting a person is for a record that should not exist.

#### Scenario: An admin deletes a person

- **WHEN** the Admin confirms deletion of a person
- **THEN** the person disappears from the people list, from the gap dashboard and from every framework they were counted under

#### Scenario: A manager cannot delete

- **WHEN** a user who is not the Admin views the people list
- **THEN** no delete control is offered for any person

#### Scenario: A non-admin submits the deletion directly

- **WHEN** a request to delete a person arrives from a user who is not the Admin
- **THEN** the request is refused and the person remains in the system

### Requirement: Deleting a person leaves nothing behind

Deleting a person SHALL remove every record that exists only because that person existed: their plan assignments and the waivers and carry-overs recorded against them, the milestones and readings recorded for them, their evaluations and the attachments of those evaluations, their custom field values, and their agent history.

It SHALL also remove the per-person plan copies made for them. A copy holds no reference back to its person, so nothing removes it automatically; a deletion that left it would leave a plan in the database belonging to nobody, with its own events, targets and recurrences.

Their uploaded files SHALL be removed from storage. Failure to remove the files SHALL NOT undo a deletion that has already been committed, since the database is the source of truth and an unreferenced file is unreachable through the application.

#### Scenario: A person who has transferred between plans

- **WHEN** the Admin deletes a person who has been assigned more than one plan over time
- **THEN** every plan copy made for them is deleted along with its events, targets and recurrences, and no plan copy without an owner remains in the database

#### Scenario: Files are removed

- **WHEN** a person with a profile photo and evaluation attachments is deleted
- **THEN** their uploads directory is removed from storage

#### Scenario: File removal fails

- **WHEN** the person's records are deleted but their files cannot be removed from storage
- **THEN** the deletion still stands and the person does not reappear

#### Scenario: The deletion is all-or-nothing

- **WHEN** any part of the database deletion fails
- **THEN** nothing is deleted and the person is left exactly as they were

### Requirement: A person deletion is confirmed against the real record

The Admin SHALL be shown, before confirming, what the deletion will actually destroy — counted from the database for that person, not estimated and not phrased generically. The confirmation SHALL name the person, and the counts SHALL be present the moment it opens, so the Admin is never asked to approve an unquantified deletion and never waits to find out what one costs.

The counts SHALL convey severity rather than completeness. Records that exist for every person as a matter of course — the fields of their card — SHALL NOT be counted separately from the person, since they are destroyed the way a name or a photo is and listing them puts the largest and least meaningful number in front of the Admin. A count of zero SHALL NOT be listed, and a person with no history at all SHALL be described as such rather than shown a column of zeroes.

#### Scenario: Opening the confirmation

- **WHEN** the Admin chooses to delete a person who has history
- **THEN** a confirmation names that person and states, without waiting, how many plan assignments, evaluations, attachments, recorded milestones and readings will be destroyed, and whether a photo will be removed

#### Scenario: A person with no history

- **WHEN** the Admin chooses to delete a person who has no assignments, evaluations, milestones, readings or files
- **THEN** the confirmation states that only the person's own record will be destroyed, rather than listing counts of zero

#### Scenario: Card fields are not itemised

- **WHEN** any deletion confirmation is shown
- **THEN** the person's custom card-field values are not presented as a separate count

#### Scenario: Declining

- **WHEN** the Admin closes the confirmation without confirming
- **THEN** nothing is deleted
