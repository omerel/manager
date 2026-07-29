# access-control

## Purpose

בקרת גישה: שני תפקידים (אדמין/מנהל), הענקות (צומת+רמה), ראות = איחוד תת-עצים, ירושת-סקופ לסוכן, ופרטיות דף החוקים.

## Requirements

### Requirement: Two roles; the tracked person is never a user

The system SHALL define exactly two user roles — **Admin** (מנהלן, who is also the אדמין) and **Manager** (מנהל) — and SHALL NOT treat a tracked person (איש) as a user. A tracked person never authenticates and exists purely as data.

#### Scenario: Person is not a user

- **WHEN** a person record is created in the registry
- **THEN** no login or user account is created for that person

#### Scenario: Only defined roles can sign in

- **WHEN** someone accesses the system
- **THEN** they act as either an Admin or a Manager, never as a tracked person

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

### Requirement: Edit gates manual data entry; view is read-only

The **edit** level SHALL permit manual creation and modification of data within the granted subtree (creating people, recording progress, filling evaluations). The **view** level SHALL permit reading only. Neither level grants configuration authority (which is Admin-only).

#### Scenario: Editor records progress

- **WHEN** an edit-level Manager records a person's progress within their subtree
- **THEN** the system SHALL accept the change

#### Scenario: Viewer cannot record progress

- **WHEN** a view-level Manager attempts to record progress
- **THEN** the system SHALL deny the write while still allowing them to read

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
