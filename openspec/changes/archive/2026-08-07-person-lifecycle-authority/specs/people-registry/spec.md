## ADDED Requirements

### Requirement: Enrolling and removing a person are section-level acts

Creating a person SHALL require establishment authority over the team they are being placed on, and deleting a person SHALL require it over their team. Correcting an existing person's details SHALL NOT — it requires only edit rights over their team, which the commander closest to them holds.

A person belonging to no team SHALL be removable by the Admin alone, there being no framework above them from which authority could derive.

The controls for these acts SHALL be shown to a user exactly when that user may perform them.

#### Scenario: A team commander corrects details but does not enrol

- **WHEN** a Manager whose edit grant sits on a team opens a person on that team
- **THEN** they may change that person's details, and are offered no control to add a person or to delete one

#### Scenario: A section commander does both

- **WHEN** a Manager holding edit on a section opens the people list
- **THEN** they are offered the control to enrol a new person, and the control to delete a person beneath their section

#### Scenario: The form offers only teams the user may enrol into

- **WHEN** a Manager opens the new-person form
- **THEN** the team choices are exactly the teams over which they hold establishment authority

#### Scenario: An unassigned person is the Admin's alone

- **WHEN** a person has no team and a Manager attempts to delete them
- **THEN** the system SHALL refuse, and the Admin SHALL still be able to

#### Scenario: The refusal holds regardless of what was displayed

- **WHEN** a create or delete request arrives for a framework the sender lacks authority over
- **THEN** the system SHALL refuse it on the server, whatever the interface offered

## RENAMED Requirements

- FROM: `### Requirement: An admin can delete a person from the people list`
- TO: `### Requirement: Deleting a person from the people list`

## MODIFIED Requirements

### Requirement: Person record and personal details

The system SHALL store a person record whose personal-detail fields follow the Admin-defined card schema, and which always includes: **first name and last name as separate fields**, **date of birth**, recruitment date, **unit placement date**, employment status (active / planned-end-date / departed), and organizational placement (team, resolving to section/domain/center). The **unit placement date** SHALL act as the anchor that converts a plan's relative offsets into calendar dates for that person. Date of birth SHALL be required when creating a person; **age SHALL be derived from it and displayed in years and months**, never stored and never manually editable.

The end-of-service field SHALL be named with the term the organisation uses — תאריך סיום שירות (תת״ש) — in the person form and in the field set offered to document extraction, so that a document using that term is matched.

#### Scenario: Creating a person

- **WHEN** a Manager with establishment authority creates a person with first name, last name, date of birth, recruitment date, unit placement date and team placement
- **THEN** the system SHALL store the record and resolve their org path from the team

### Requirement: Deleting a person from the people list

The people list SHALL offer a control that deletes a person to the users who hold establishment authority over that person's framework — a commander with edit rights granted at section level or above, and the Admin. The control SHALL NOT appear for anyone else, and the deletion SHALL be refused on the server when requested by a user without that authority, so that hiding the control is presentation and not the protection itself.

Because the authority follows each person's own framework, the control SHALL be decided per person and not per viewer: a commander may see it on one row and not on another.

Deletion SHALL be distinct from departure. A person who has left service is recorded through their employment status and keeps their record; deleting a person is for a record that should not exist.

#### Scenario: A section commander deletes a person

- **WHEN** a commander with establishment authority confirms deletion of a person beneath them
- **THEN** the person disappears from the people list, from the gap dashboard and from every framework they were counted under

#### Scenario: A team commander cannot delete

- **WHEN** a Manager whose edit grant sits on a team views the people list
- **THEN** no delete control is offered for any person, including those on their own team

#### Scenario: An unauthorized deletion submitted directly

- **WHEN** a request to delete a person arrives from a user without establishment authority over that person's framework
- **THEN** the request is refused and the person remains in the system
