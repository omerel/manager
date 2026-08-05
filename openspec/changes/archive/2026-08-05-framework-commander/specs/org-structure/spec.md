## ADDED Requirements

### Requirement: A framework shows who commands it

The hierarchy view SHALL show, beside each framework, the name of the user who commands it, and SHALL show nothing where a framework has no commander.

#### Scenario: Reading the chain of command from the tree

- **WHEN** the Admin opens the hierarchy view
- **THEN** each commanded framework displays its commander's name, and uncommanded frameworks display no commander

## MODIFIED Requirements

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
