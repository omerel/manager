## ADDED Requirements

### Requirement: A user may command one framework

A user record SHALL carry an optional **commanded framework** — a single node anywhere in the org tree (center, domain, section, or team). The field MAY be empty, and an empty value SHALL be treated as the normal state rather than as incomplete data: users who hold only view or edit access command nothing.

The Admin SHALL be able to set, change, and clear the commanded framework both when creating a user and when editing an existing one. The chooser SHALL identify each framework by its full path through the hierarchy, because framework names repeat between branches. When editing an existing user, the chooser SHALL offer only frameworks that user can already see.

#### Scenario: Creating a commander

- **WHEN** the Admin creates a user, grants them access to a framework, and selects that framework to command
- **THEN** the user is created carrying that framework, and it is shown on their row

#### Scenario: Creating a user who commands nothing

- **WHEN** the Admin creates a user and leaves the commanded framework empty
- **THEN** the user is created without complaint and no framework is attributed to them

#### Scenario: Clearing a command

- **WHEN** the Admin edits a commander and clears the framework field
- **THEN** the user commands nothing, the framework has no commander, and the user's access grants are unchanged

#### Scenario: The chooser disambiguates repeated names

- **WHEN** two teams in different branches share a name
- **THEN** the chooser distinguishes them by their full path, not by name alone

### Requirement: A framework has at most one commander

Each framework SHALL have at most one commander. An attempt to make a user commander of a framework that is already commanded SHALL be refused, and the refusal SHALL name the current commander and state that the command must be removed from them first. The system SHALL NOT transfer the command automatically.

This uniqueness SHALL be enforced by the database and not by application checks alone, so that two Admins submitting at the same moment cannot both succeed.

#### Scenario: A second commander is refused

- **WHEN** the Admin assigns a framework that another user already commands
- **THEN** the assignment is refused with a message naming the current commander, and neither user's record changes

#### Scenario: Replacing a commander deliberately

- **WHEN** the Admin first clears the command from the current commander and then assigns the framework to another user
- **THEN** the assignment succeeds

#### Scenario: Simultaneous assignment

- **WHEN** two Admins assign the same framework to two different users at the same moment
- **THEN** exactly one succeeds and the other is refused; the framework never ends up with two commanders

### Requirement: Command requires access but confers none

A user SHALL NOT be made commander of a framework that lies outside their effective visibility. The framework MAY be any node their grants already reach — a grant over a domain qualifies its sections and teams — and either level, view or edit, SHALL satisfy the condition. An Admin, who sees the whole tree, MAY command any framework.

Commanding SHALL confer no visibility and no editing rights of its own. The system SHALL NOT create, modify, or remove an access grant as a consequence of assigning or clearing a command, and effective visibility SHALL continue to be derived from access grants alone.

#### Scenario: Appointing without access is refused

- **WHEN** the Admin tries to make a user commander of a framework the user cannot see
- **THEN** the appointment is refused with a message explaining that access must be granted first, and no grant is created

#### Scenario: A grant higher up the tree qualifies

- **WHEN** a user holds a view grant over a domain and the Admin makes them commander of a section beneath it
- **THEN** the appointment succeeds

#### Scenario: Appointing changes no access

- **WHEN** a user holding a view grant over a domain is made commander of a section beneath it
- **THEN** their grants are unchanged and their level over that section remains view

### Requirement: Access is not withdrawn from beneath a command

While a user commands a framework, the system SHALL refuse any deliberate act that would remove their access to it, and SHALL name the commanded framework in the refusal so the Admin can see what is blocking. This applies to removing an access grant that covers the commanded framework.

A user's role SHALL remain fixed after creation, so an Admin — who sees the whole tree — cannot be demoted out of sight of the framework they command.

Deleting the framework itself SHALL NOT be refused — see the org-structure capability, where the command is released with the framework.

#### Scenario: Removing the covering grant is refused

- **WHEN** the Admin removes a grant from a user who commands a framework within that grant's subtree
- **THEN** the removal is refused, the message names the commanded framework, and the grant remains

#### Scenario: Removing an unrelated grant is allowed

- **WHEN** the Admin removes a grant from a commander, and another grant still covers the commanded framework
- **THEN** the removal succeeds

#### Scenario: The last covering grant is protected

- **WHEN** a commander holds two grants that both cover the framework and the Admin removes one, then tries to remove the other
- **THEN** the first removal succeeds and the second is refused

#### Scenario: An Admin's reach cannot be demoted away

- **WHEN** an Admin commands a framework
- **THEN** no edit path can lower their role, so their sight of that framework cannot be withdrawn

### Requirement: A user may be created with a first access grant

The create-user form SHALL accept an optional first access grant — a framework and a level — applied as the new user's grant at creation. A user MAY still be created with no grant at all.

This exists so a command can be assigned in the same action that creates the user: a new user has no grants until one is given, so without it the commanded-framework field could never be filled at creation.

#### Scenario: Created with access and a command together

- **WHEN** the Admin creates a user with an edit grant over a section and names that same section as commanded
- **THEN** the user is created holding the grant and the command

#### Scenario: A command outside the first grant is refused

- **WHEN** the Admin creates a non-Admin user whose commanded framework lies outside the first grant's subtree
- **THEN** creation is refused, explaining that the command must fall within the granted access, and no user is created

#### Scenario: Created with neither

- **WHEN** the Admin creates a user leaving both the first grant and the commanded framework empty
- **THEN** the user is created with no grants and no command

### Requirement: Command assignments are recorded in the activity log

Assigning, changing, and clearing a commanded framework SHALL each be written to the activity log, naming the user and the framework involved.

#### Scenario: An assignment is logged

- **WHEN** the Admin makes a user commander of a framework
- **THEN** the activity log records who did it, which user was appointed, and which framework
