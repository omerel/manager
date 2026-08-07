# access-control

## Purpose

בקרת גישה: שלושה תפקידים (אדמין/מנהל/משא״ן), הענקות (צומת+רמה), ראות = איחוד תת-עצים, ירושת-סקופ לסוכן, ופרטיות דף החוקים.

## Requirements

### Requirement: Three roles; the tracked person is never a user

The system SHALL define exactly three user roles — **Admin** (מנהלן, who is also the אדמין), **Manager** (מנהל) and **HR** (משא״ן) — and SHALL NOT treat a tracked person (איש) as a user. A tracked person never authenticates and exists purely as data.

HR SHALL be operational rather than configurational: what an HR user sees and may change follows from their access grants exactly as it does for a Manager, and the Admin SHALL remain the sole authority for users, grants, plan templates and the person-card schema. HR SHALL NOT confer establishment authority; an HR user enrols or removes a person only under the same rule as anyone else — an edit grant at section level or above.

Every place that names a user's role SHALL read one definition of the labels, so that adding a role cannot leave a screen silently calling it by another role's name.

#### Scenario: Person is not a user

- **WHEN** a person record is created in the registry
- **THEN** no login or user account is created for that person

#### Scenario: Only defined roles can sign in

- **WHEN** someone accesses the system
- **THEN** they act as an Admin, a Manager or an HR user, never as a tracked person

#### Scenario: HR cannot configure

- **WHEN** an HR user attempts to change access grants, plan templates, or the person-card schema
- **THEN** the system SHALL deny the action, exactly as it does for a Manager

#### Scenario: HR does not gain establishment authority from the role

- **WHEN** an HR user whose only edit grant sits on a team attempts to enrol or remove a person
- **THEN** the system SHALL refuse, the rule being the level the grant sits at and not the role

#### Scenario: Every screen names the role correctly

- **WHEN** an HR user's role is displayed anywhere it is shown
- **THEN** it reads משא״ן, and not the label of another role

### Requirement: Admin is the sole authority for configuration and access

The Admin SHALL be the only role that: manages users and their access grants, authors career-plan templates, and defines the person-card field schema. Managers SHALL NOT perform these configuration actions.

#### Scenario: Admin grants access

- **WHEN** an Admin adds a Manager and assigns them access
- **THEN** the Manager gains access as configured; no other role can create that grant

#### Scenario: Manager cannot self-grant or configure

- **WHEN** a Manager attempts to change access grants, plan templates, or the person-card schema
- **THEN** the system SHALL deny the action

### Requirement: Access grant is a node plus a level

An access grant SHALL be a pair of (org-tree node, level) where level is either **view** or **edit**. A user MAY hold multiple grants. The user's effective visibility SHALL be the union of the subtrees rooted at their granted nodes, with the level applied per subtree.

#### Scenario: Subtree visibility

- **WHEN** a Manager is granted (domain A, edit)
- **THEN** they can see every section, team, and person beneath domain A

#### Scenario: Union of multiple grants

- **WHEN** a Manager holds (domain A, edit) and (team B3, view)
- **THEN** their visibility is domain A ∪ team B3, with edit rights inside domain A and read-only inside team B3

### Requirement: The query page belongs to correspondents, not only to commanders

Access to the query page SHALL follow from holding a correspondent identity: commanding a framework, or being an HR user with at least one access grant. A user who is neither SHALL have no access to the page.

An HR user's correspondent identity SHALL be their own, not the framework they are granted over. The commander of that framework SHALL NOT see, act on, or be considered the sender of an HR user's queries.

#### Scenario: An HR user reaches the page

- **WHEN** an HR user with a grant opens the system
- **THEN** the query page is offered to them, though they command nothing

#### Scenario: An HR user with no grant

- **WHEN** an HR user holds no access grant at all
- **THEN** the query page is closed to them, as it is to a Manager who commands nothing

#### Scenario: The commander of the granted framework is not the sender

- **WHEN** an HR user granted over a domain sends a query, and the domain's commander opens their own page
- **THEN** that commander does not see the HR user's query among the queries their framework sent, and cannot close, edit or delete it

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

### Requirement: The agent inherits the invoking user's visibility

When the read-only agent (rules or chat) runs on behalf of a user, its data visibility SHALL be constrained to that user's effective visibility. Because the agent only reads, the **view** level is sufficient for full agent use, and the agent SHALL be unable to access any data outside the user's scope.

#### Scenario: Agent scoped to user

- **WHEN** a Manager whose visibility is domain A runs a rule "list everyone behind"
- **THEN** the result includes only people within domain A, because the agent cannot see beyond it

#### Scenario: Viewer gets full agent use

- **WHEN** a view-level Manager runs a rule or asks a chat question
- **THEN** the agent operates normally within their read-only scope

### Requirement: The rules page is private per user

Each user's rules page SHALL be private to that user and SHALL NOT be visible to other users, including higher-node Managers or the Admin, even though those users may see the underlying career data the rules operate on.

#### Scenario: Superior cannot see subordinate's rules

- **WHEN** a domain-level Manager views the data of a team beneath them
- **THEN** they SHALL NOT see the private rules page of a team-level Manager under them

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
