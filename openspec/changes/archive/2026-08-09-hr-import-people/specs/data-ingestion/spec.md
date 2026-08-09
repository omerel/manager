## ADDED Requirements

### Requirement: An identity value belongs to one person

תעודת זהות and מספר אישי SHALL be treated as identity keys: entering a value already recorded for another person SHALL be refused, naming the holder — in manual creation and editing as in bulk import. Enforcement lives in the writing actions; the fields' storage is unchanged.

#### Scenario: A duplicate identity value is refused

- **WHEN** a person is edited to carry a תעודת זהות already recorded for someone else
- **THEN** the change is refused naming the other person, and nothing is written

#### Scenario: Re-saving your own value

- **WHEN** a person is saved carrying their own existing identity value
- **THEN** the save proceeds — the value belongs to them

### Requirement: Intake extraction identifies the framework

The document-intake extraction SHALL also try to identify the person's framework from the document, offering it in the proposed card like any other extracted field. The name SHALL be resolved only within the operator's edit scope, an ambiguous or unknown name SHALL leave the field empty for the human to fill, and the resolution logic SHALL be the same one the table import uses.

#### Scenario: The document names a team

- **WHEN** an intake document names a team that exists once within the operator's scope
- **THEN** the proposed card carries that team, still subject to the operator's approval

#### Scenario: An unresolvable name stays empty

- **WHEN** the document's framework name is ambiguous in scope, or unknown
- **THEN** the framework field of the proposal is left empty rather than guessed
