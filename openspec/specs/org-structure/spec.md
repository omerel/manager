# org-structure

## Purpose

העץ הארגוני מרכז ▸ תחום ▸ מדור ▸ צוות ▸ איש, וסמנטיקת ה-rollup שכל אגרגציה במערכת נשענת עליה.

## Requirements

### Requirement: Organizational hierarchy

The system SHALL model a strict four-level organizational tree with people as leaves: `center (מרכז) ▸ domain (תחום) ▸ section (מדור) ▸ team (צוות) ▸ person (איש)`. Each non-root node MUST have exactly one parent, and every person MUST be placed under exactly one team.

#### Scenario: Placing a person in the tree

- **WHEN** a manager assigns a person to a team
- **THEN** the person inherits a unique path `center ▸ domain ▸ section ▸ team` derived from that team's position in the tree

#### Scenario: Rejecting an incomplete placement

- **WHEN** a manager tries to place a person under a node that is not a team (e.g. directly under a domain)
- **THEN** the system SHALL reject the placement and require a team-level node

### Requirement: Rollup aggregation up the tree

The system SHALL aggregate person-level metrics (such as gap counts) upward to team, section, domain, and center levels, so that any node reports the totals of all people beneath it.

#### Scenario: Aggregating gaps to a domain

- **WHEN** a domain contains sections, teams, and people with a total of N people in gap state 🔴
- **THEN** the domain node SHALL report N as its rolled-up 🔴 count, equal to the sum of its descendant teams' counts

#### Scenario: Drilling down from an aggregate

- **WHEN** a manager selects a rolled-up count at any tree level
- **THEN** the system SHALL let them drill down to the underlying people that contributed to that count

### Requirement: Editing an existing framework

The Admin SHALL be able to edit a framework after creation — its name, its kind, and its parent — and the system SHALL reject changes that would break the `center ▸ domain ▸ section ▸ team` structure: a parent of the wrong kind, moving a framework beneath its own descendant, or a kind change that leaves existing children or attached people invalid.

#### Scenario: Renaming and moving

- **WHEN** the Admin renames a framework or moves it under a valid parent of the expected kind
- **THEN** the change is saved and the tree reflects it everywhere (dashboard, grants, person paths)

#### Scenario: Invalid parent kind

- **WHEN** the Admin tries to place a team directly under a domain
- **THEN** the system SHALL reject the change with an explanatory message and leave the tree unchanged

#### Scenario: Cycle prevented

- **WHEN** the Admin tries to move a framework under one of its own descendants
- **THEN** the system SHALL reject the change

#### Scenario: Kind change that would break children

- **WHEN** the Admin changes a framework's kind such that its existing children or attached people would no longer be valid
- **THEN** the system SHALL reject the change and explain what blocks it

### Requirement: Confirmed cascade deletion

Deleting a framework that has sub-frameworks SHALL NOT fail: the Admin SHALL first be shown a confirmation stating what will be removed — the number of sub-frameworks and the number of people who will become unassigned — and on confirmation the framework and its entire subtree are deleted, with affected people left unassigned.

Deleting a framework SHALL release any command over it: the commanding user's record SHALL survive intact, with their commanded framework becoming empty. Deleting a framework SHALL NEVER delete a user account.

#### Scenario: Deleting a parent framework

- **WHEN** the Admin deletes a framework that has sub-frameworks and confirms the warning
- **THEN** the framework and all its descendants are removed, and people who were attached to them become unassigned

#### Scenario: Declining the confirmation

- **WHEN** the Admin cancels the confirmation
- **THEN** nothing is deleted

#### Scenario: No page error

- **WHEN** a deletion involves sub-frameworks
- **THEN** the user sees a confirmation dialog rather than an error page

#### Scenario: Deleting a commanded framework

- **WHEN** the Admin deletes a framework that has a commander
- **THEN** the framework is removed, the commanding user's account, grants, and rules are untouched, and that user simply commands nothing

### Requirement: A framework shows who commands it

The hierarchy view SHALL show, beside each framework, the name of the user who commands it, and SHALL show nothing where a framework has no commander.

#### Scenario: Reading the chain of command from the tree

- **WHEN** the Admin opens the hierarchy view
- **THEN** each commanded framework displays its commander's name, and uncommanded frameworks display no commander

### Requirement: The org tree can be imported from a file

The Admin SHALL be able to build the whole org tree from one Excel or CSV file carrying three meanings: the framework's name, its kind, and the name of its parent framework — the kinds being those the system already defines. A row with no parent is a root, and a root SHALL be a center.

The file's columns SHALL NOT have to be named the system's way. The system SHALL propose a mapping from the file's own headers, leaving unrecognised columns out rather than guessing at them, and the Admin SHALL be able to correct that mapping before approving it. Validation SHALL then run over the columns the Admin approved, and a meaning left unmapped SHALL be reported as a fault before any row is examined.

Under that mapping the file SHALL be validated in full before anything is written, and the result presented as a report naming each fault by its row: a kind the system does not have, a parent that appears in no row, a parent whose kind cannot hold this child, a root that is not a center, two frameworks of the same name under the same parent, a parent chain that closes on itself, or a file with no rows. A fault SHALL NOT be correctable in place — the report is for taking back to the file. Nothing SHALL be written while any fault stands.

Approval SHALL replace the existing tree rather than merge into it, in a single transaction, and SHALL be preceded by a confirmation stating in real counts what the replacement destroys: the frameworks themselves, the access grants that hang off them, the queries anchored to them, the commander appointments they carry, and the framework of every person — the people themselves surviving, unassigned. Where no tree exists, the confirmation SHALL say so instead and the import SHALL simply apply. The import SHALL be recorded in the activity log.

#### Scenario: Foreign column names are mapped, not refused

- **WHEN** a file arrives with headers the system does not know
- **THEN** it proposes what it recognises, leaves the rest out, and lets the Admin correct the mapping before anything is validated

#### Scenario: Validation follows the approved mapping

- **WHEN** the Admin re-points the parent meaning at a different column and approves
- **THEN** the rows are validated by that column, not by the one the system had proposed

#### Scenario: A missing meaning is a fault of its own

- **WHEN** the mapping approved leaves the kind unmapped
- **THEN** that is reported before any row is examined, and nothing is written

#### Scenario: A valid file builds the tree

- **WHEN** the Admin uploads a file of frameworks each naming an existing parent, and approves it
- **THEN** the tree is exactly the file's, and the act is recorded

#### Scenario: A fault stops everything

- **WHEN** any row names a parent that appears in no row, or a kind that does not exist
- **THEN** the report names that row and its fault, no framework is created, and the existing tree is untouched

#### Scenario: The report is read, not edited

- **WHEN** the report shows faults
- **THEN** the Admin corrects the file and uploads it again; the faults cannot be fixed on the screen

#### Scenario: Replacing a tree states its full cost

- **WHEN** a tree already exists and the Admin approves an import
- **THEN** the confirmation states, in counts read from the database, how many frameworks, access grants, queries and commander appointments will be destroyed and how many people will be left without a framework — and nothing happens until it is confirmed

#### Scenario: An empty system just receives it

- **WHEN** no framework exists yet
- **THEN** the confirmation says there is nothing to replace, and approval simply builds the tree

#### Scenario: All or nothing

- **WHEN** the replacement fails part-way through
- **THEN** the previous tree stands unchanged, rather than a half-replaced one
