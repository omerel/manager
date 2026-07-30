## ADDED Requirements

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

#### Scenario: Deleting a parent framework

- **WHEN** the Admin deletes a framework that has sub-frameworks and confirms the warning
- **THEN** the framework and all its descendants are removed, and people who were attached to them become unassigned

#### Scenario: Declining the confirmation

- **WHEN** the Admin cancels the confirmation
- **THEN** nothing is deleted

#### Scenario: No page error

- **WHEN** a deletion involves sub-frameworks
- **THEN** the user sees a confirmation dialog rather than an error page
