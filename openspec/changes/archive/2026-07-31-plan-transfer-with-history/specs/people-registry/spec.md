## MODIFIED Requirements

### Requirement: Plan assignment as a template copy

When a plan is assigned to a person, the system SHALL assign a **copy** of the template so that later edits to the template do not retroactively alter the person's assigned plan. A person SHALL have at most one active assignment at a time, and every assignment they have ever had SHALL be retained as a record of the period it covered.

#### Scenario: Assigning a plan

- **WHEN** a manager assigns template plan A to a person
- **THEN** the person receives an independent copy, and subsequent edits to template A do not change the person's plan

#### Scenario: One active plan

- **WHEN** a person is assigned a new plan while they already have one
- **THEN** the earlier assignment is ended rather than removed, and only the new one is active

## ADDED Requirements

### Requirement: A person's plan history is visible on their card

A person's card SHALL show the plans they have been assigned over time — for each, the period it covered, the reason recorded for leaving it, and what was achieved and left unmet during it. Waived items of the active plan SHALL be shown and marked rather than hidden, so that an item not counted as a gap can be told apart from one that is simply absent.

#### Scenario: Viewing a person who has transferred

- **WHEN** a Manager opens the card of a person who has moved between plans
- **THEN** the previous plans are listed with their periods, and each shows what was completed and what was left unmet

#### Scenario: A waived item is visible

- **WHEN** the active plan contains an item waived because it predates the assignment
- **THEN** the item is displayed with a mark identifying it as waived, not omitted from the plan
