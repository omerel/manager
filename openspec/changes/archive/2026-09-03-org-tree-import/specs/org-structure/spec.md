# org-structure — delta

## ADDED Requirements

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
