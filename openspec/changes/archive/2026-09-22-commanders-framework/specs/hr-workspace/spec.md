## MODIFIED Requirements

### Requirement: The row's framework is resolved within the importer's scope

The system SHALL try to identify each new person's framework from the row, resolving the name only within the HR user's edit scope, and considering every framework that holds people — teams and commanders frameworks alike. A framework that is empty, unknown or ambiguous SHALL NOT block the person: the row creates WITHOUT a framework, the reason shown as a warning before approval. Creation into a RESOLVED framework SHALL require establishment authority over it, exactly as manual intake does; that refusal remains a hard error — softening it into an unassigned create would be a bypass of the establishment rule.

#### Scenario: The framework is named in the file

- **WHEN** a row names a team that exists once within the importer's scope
- **THEN** the candidate is created into that team, given establishment authority over it

#### Scenario: A commanders framework is named in the file

- **WHEN** a row names a commanders framework that exists within the importer's scope
- **THEN** it resolves exactly as a team would, the commanders framework's globally unique name leaving nothing to disambiguate

#### Scenario: An unknown framework does not block the person

- **WHEN** a row names a framework that does not exist in scope, or names none
- **THEN** the person is created without a framework, and the row carries the warning saying so

#### Scenario: A repeated name warns and creates unassigned

- **WHEN** two frameworks in the importer's scope share the row's framework name
- **THEN** the person is created without a framework, the warning naming both candidates

#### Scenario: No establishment authority

- **WHEN** the importer's grant over the resolved framework is below section level
- **THEN** the row is an error naming the missing authority, as manual intake would refuse
