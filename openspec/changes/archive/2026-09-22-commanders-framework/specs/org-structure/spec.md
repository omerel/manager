## ADDED Requirements

### Requirement: A commanders framework holds the cards of subordinate commanders

The system SHALL define a fifth framework kind, **מפקדים** (commanders), whose purpose is to hold the person-cards of commanders so that a commander's card never sits inside the framework they themselves command.

A commanders framework SHALL be permitted under a center, a domain or a section, and SHALL NOT be permitted under a team — a team has no child frameworks and therefore no subordinate commanders to hold. It SHALL be a leaf: no framework of any kind may be placed beneath it.

The rule it expresses SHALL be: *a commanders framework under X holds the cards of the commanders of X's children, and is filled by the commander of X.* No new access rule is introduced to achieve this — a commanders framework is a sibling of the frameworks whose commanders it holds, so it falls outside their subtrees and inside their parent's, and existing visibility and establishment rules produce the intended result unchanged.

A commanders framework SHALL be created only by the Admin, only as a deliberate act, and SHALL NOT be created automatically under any circumstance — not on framework creation, not on import, and not as a synthetic node. A framework without one SHALL continue to behave exactly as it does without this feature.

The name of a commanders framework SHALL be entered by the Admin rather than derived, and SHALL be unique across all commanders frameworks in the system. The system SHALL refuse a name already borne by another commanders framework, wherever in the tree it sits. This uniqueness SHALL NOT be extended to frameworks of other kinds, whose names may legitimately repeat between branches.

A commanders framework SHALL NOT be given a commander of its own; the commander responsible for it is the commander of its parent.

Where a commanders framework exists among a framework's children, it SHALL be presented first among them, ahead of the ordinary frameworks.

Where a screen composes a framework's label as *kind: name*, the kind prefix SHALL be omitted when the name already begins with the word מפקדים, so that the label does not repeat itself — while a differently named commanders framework still shows its kind.

#### Scenario: A commander's card leaves their own subtree

- **WHEN** the Admin creates a commanders framework under a section and moves the card of a team commander from that team into it
- **THEN** that team commander can no longer see or edit their own card, and the section's commander can

#### Scenario: Not under a team

- **WHEN** the Admin tries to create a commanders framework whose parent is a team
- **THEN** the system SHALL refuse and explain that a team has no subordinate commanders

#### Scenario: Nothing may be placed beneath it

- **WHEN** the Admin tries to create any framework whose parent is a commanders framework
- **THEN** the system SHALL refuse

#### Scenario: A duplicate name is refused

- **WHEN** the Admin creates a commanders framework with a name already used by a commanders framework in another branch
- **THEN** the system SHALL refuse and name the collision, and the Admin SHALL be able to enter a different name

#### Scenario: The uniqueness rule does not reach other frameworks

- **WHEN** two teams in different branches already share a name
- **THEN** neither is affected by this change, and both remain valid

#### Scenario: Never created on its own

- **WHEN** the Admin creates a section, a domain or a center by any means, including a file import
- **THEN** no commanders framework is created alongside it

#### Scenario: Presented first among siblings

- **WHEN** a section holds a commanders framework and several teams
- **THEN** the commanders framework is listed before the teams

## MODIFIED Requirements

### Requirement: Organizational hierarchy

The system SHALL model an organizational tree of `center (מרכז) ▸ domain (תחום) ▸ section (מדור) ▸ team (צוות) ▸ person (איש)`, with one framework kind standing outside that ladder: a **commanders** framework (מפקדים), which may sit under a center, a domain or a section as a sibling of the ordinary frameworks. Each non-root node MUST have exactly one parent.

Every person MUST be placed under exactly one framework that holds people, and the kinds that hold people SHALL be exactly team and commanders. Placement under a center, a domain or a section SHALL remain invalid.

#### Scenario: Placing a person in the tree

- **WHEN** a manager assigns a person to a team
- **THEN** the person inherits a unique path `center ▸ domain ▸ section ▸ team` derived from that team's position in the tree

#### Scenario: Placing a commander's card

- **WHEN** a manager assigns a person to a commanders framework
- **THEN** the placement is accepted and the person's path is derived from that framework's position in the tree exactly as a team's would be

#### Scenario: Rejecting an incomplete placement

- **WHEN** a manager tries to place a person under a node that holds no people (a center, a domain or a section)
- **THEN** the system SHALL reject the placement and require a framework that holds people

### Requirement: Editing an existing framework

The Admin SHALL be able to edit a framework after creation — its name, its kind, and its parent — and the system SHALL reject changes that would break the structure: a parent of a kind that may not hold this child, moving a framework beneath its own descendant, or a kind change that leaves existing children or attached people invalid. Renaming a commanders framework SHALL be subject to the same global uniqueness rule that governs its creation.

Renaming a framework SHALL NOT alter the name of any other framework, including a commanders framework beneath it whose name mentions it.

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

#### Scenario: Renaming into a collision

- **WHEN** the Admin renames a commanders framework to a name another commanders framework already bears
- **THEN** the system SHALL refuse and leave the name unchanged

#### Scenario: A parent's rename leaves its commanders framework alone

- **WHEN** the Admin renames a section beneath which a commanders framework named after it sits
- **THEN** only the section is renamed; the commanders framework keeps the name it was given, and the Admin may change it separately

### Requirement: The org tree can be imported from a file

The Admin SHALL be able to build the whole org tree from one Excel or CSV file carrying three meanings: the framework's name, its kind, and the name of its parent framework — the kinds being those the system already defines, the commanders kind among them. A row with no parent is a root, and a root SHALL be a center.

The file's columns SHALL NOT have to be named the system's way. The system SHALL propose a mapping from the file's own headers, leaving unrecognised columns out rather than guessing at them, and the Admin SHALL be able to correct that mapping before approving it. Validation SHALL then run over the columns the Admin approved, and a meaning left unmapped SHALL be reported as a fault before any row is examined.

Under that mapping the file SHALL be validated in full before anything is written, and the result presented as a report naming each fault by its row: a kind the system does not have, a parent that appears in no row, a parent whose kind cannot hold this child, a root that is not a center, two frameworks of the same name under the same parent, two commanders frameworks of the same name anywhere in the file, a framework placed beneath a commanders framework, a parent chain that closes on itself, or a file with no rows. A fault SHALL NOT be correctable in place — the report is for taking back to the file. Nothing SHALL be written while any fault stands.

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

#### Scenario: A commanders framework in the file

- **WHEN** a row names the commanders kind and a parent that is a center, a domain or a section
- **THEN** the row is valid and the framework is created in that position

#### Scenario: A commanders framework under a team is a fault

- **WHEN** a row names the commanders kind and a parent that is a team
- **THEN** the report names that row and its fault, and nothing is written

#### Scenario: Two commanders frameworks of the same name

- **WHEN** two rows name the commanders kind with the same framework name, under different parents
- **THEN** the report names both rows, and nothing is written

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
