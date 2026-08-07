## MODIFIED Requirements

### Requirement: Edit gates manual data entry; view is read-only

The **edit** level SHALL permit manual modification of data within the granted subtree (correcting a person's details, recording progress, filling evaluations). The **view** level SHALL permit reading only. Neither level grants configuration authority (which is Admin-only), and neither by itself grants the establishment acts of enrolling or removing a person — those require the authority defined below.

#### Scenario: Editor records progress

- **WHEN** an edit-level Manager records a person's progress within their subtree
- **THEN** the system SHALL accept the change

#### Scenario: Viewer cannot record progress

- **WHEN** a view-level Manager attempts to record progress
- **THEN** the system SHALL deny the write while still allowing them to read

#### Scenario: Editing details is not enrolling

- **WHEN** an edit-level Manager whose grant sits on a team corrects a person's details on that team
- **THEN** the system SHALL accept it, while still refusing that same user's attempt to enrol or remove a person

## ADDED Requirements

### Requirement: Establishment authority derives from the level a grant sits at

Enrolling a person into the registry and removing one from it SHALL require an **edit** grant whose own node is a **section, domain or centre** — not merely edit rights that reach the team from anywhere. A grant sitting on a team SHALL NOT confer it, even though it confers edit over that team.

The system SHALL derive this from the grant's position in the tree rather than from framework command, keeping the separation that command requires access and confers none. The Admin SHALL hold this authority over every framework.

Whether a user holds this authority over a given framework SHALL be stated once and read by every part that asks — the guard that refuses the act, the form that offers a team to enrol into, and the interface that decides whether to show the control.

#### Scenario: A section commander enrols

- **WHEN** a Manager holding edit on a section creates a person on a team beneath it
- **THEN** the system SHALL accept it

#### Scenario: A team-level grant does not enrol

- **WHEN** a Manager whose only edit grant sits on a team attempts to create a person on that team
- **THEN** the system SHALL refuse, while that same user may still edit the details of people already on it

#### Scenario: The authority reaches down the whole subtree

- **WHEN** a Manager holding edit on a centre enrols someone on a team three levels beneath
- **THEN** the system SHALL accept it, the authority following the granted subtree exactly as visibility does

#### Scenario: A view grant never confers it

- **WHEN** a Manager holds only a view grant on a domain
- **THEN** the system SHALL refuse both enrolling and removing anywhere beneath it

#### Scenario: The Admin holds it everywhere

- **WHEN** the Admin enrols or removes a person on any framework
- **THEN** the system SHALL accept it, without the Admin commanding or being granted anything

#### Scenario: One definition, not three

- **WHEN** the form offers the teams a user may enrol into
- **THEN** every offered team is one the action would accept, and no team the action would accept is withheld
