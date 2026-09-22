## MODIFIED Requirements

### Requirement: Enrolling and removing a person are section-level acts

Creating a person SHALL require establishment authority over the framework they are being placed on, and deleting a person SHALL require it over their framework. Correcting an existing person's details SHALL NOT — it requires only edit rights over their framework, which the commander closest to them holds.

The frameworks a person may be placed on are those that hold people — teams and commanders frameworks alike — and the same authority rule SHALL govern both without exception. A commanders framework sits beneath a section, a domain or a center, so establishment authority over it derives from a grant at section level or above exactly as it does for a team; nothing about the commanders kind loosens or tightens the rule.

A person belonging to no framework SHALL be removable by the Admin alone, there being no framework above them from which authority could derive.

The controls for these acts SHALL be shown to a user exactly when that user may perform them.

#### Scenario: A team commander corrects details but does not enrol

- **WHEN** a Manager whose edit grant sits on a team opens a person on that team
- **THEN** they may change that person's details, and are offered no control to add a person or to delete one

#### Scenario: A section commander does both

- **WHEN** a Manager holding edit on a section opens the people list
- **THEN** they are offered the control to enrol a new person, and the control to delete a person beneath their section

#### Scenario: The form offers only teams the user may enrol into

- **WHEN** a Manager opens the new-person form
- **THEN** the framework choices are exactly the people-holding frameworks — teams and commanders frameworks — over which they hold establishment authority

#### Scenario: A section commander enrols into their commanders framework

- **WHEN** a Manager holding edit on a section opens the new-person form, and that section holds a commanders framework
- **THEN** that commanders framework is among the choices offered, and a person may be enrolled into it

#### Scenario: A team commander is offered no commanders framework

- **WHEN** a Manager whose only grant sits on a team opens the new-person form
- **THEN** the commanders framework beside their team is not offered, being neither within their visibility nor within their establishment authority

#### Scenario: An unassigned person is the Admin's alone

- **WHEN** a person has no framework and a Manager attempts to delete them
- **THEN** the system SHALL refuse, and the Admin SHALL still be able to

#### Scenario: The refusal holds regardless of what was displayed

- **WHEN** a create or delete request arrives for a framework the sender lacks authority over
- **THEN** the system SHALL refuse it on the server, whatever the interface offered
