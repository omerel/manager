## ADDED Requirements

### Requirement: The agent knows everything the person card knows

The data the agent answers from SHALL carry every core field of the person card, including the date of birth and the age derived from it. A field a user can read on a person's card SHALL NOT be absent from what the agent can read.

The age SHALL be computed by the same function the card uses, and carried alongside the date rather than left for the agent to derive, so that the two surfaces cannot disagree about a person's age.

#### Scenario: Asking about birthdays

- **WHEN** a user asks for a list of birthdays
- **THEN** the agent answers from the recorded dates of birth, for the people in their scope who have one

#### Scenario: Asking by age

- **WHEN** a user asks who is over a given age
- **THEN** the agent answers using the same age the person card shows

#### Scenario: A person with no date recorded

- **WHEN** a person has no date of birth
- **THEN** they are reported as having none, rather than being silently omitted from the count

### Requirement: The agent knows which fields exist, not only which are filled

The data the agent answers from SHALL include the definitions of the configurable person-card fields — their labels, their types, and the permitted options where a field offers a choice — separately from the values recorded against people.

Without this the agent cannot distinguish a field that does not exist from a field nobody has filled in, and answers both with "there is no such field". These are different answers and SHALL be given differently.

#### Scenario: A field nobody has filled

- **WHEN** a user asks about a configured field that no person has a value for
- **THEN** the agent reports that the field exists and holds no values, rather than that it does not exist

#### Scenario: A field that does not exist

- **WHEN** a user asks about something that is not a field at all
- **THEN** the agent reports that no such field is defined

#### Scenario: The options of a choice field

- **WHEN** a user asks what values a choice field can take
- **THEN** the agent can answer from the definitions, without inferring them from the values that happen to be in use

### Requirement: One date convention throughout the agent's data

Every date in the data the agent answers from SHALL be written in ISO form, including the values of configurable fields of date type, which are stored as they were typed. The agent's copy SHALL NOT mix day-first and ISO dates.

#### Scenario: A configurable date field

- **WHEN** a person has a value in a configurable field of date type
- **THEN** the agent reads it in the same ISO form as every other date, not in the day-first form it was entered in

#### Scenario: An unreadable stored value

- **WHEN** a stored date value cannot be read as a date
- **THEN** it is carried through as it stands rather than being guessed at

### Requirement: The card and the agent's data are checked against each other

There SHALL be a check that compares the core fields of the person card against the data exported for the agent, and fails when a field exists in one and not the other.

The check SHALL be a comparison of the two, not an assertion about any particular field, so that a core field added to the card in future and not to the agent's data is caught rather than quietly missing.

#### Scenario: A core field is added to the card only

- **WHEN** a core field is added to the person card and not to the agent's data
- **THEN** the check fails, naming the field

#### Scenario: Both are in step

- **WHEN** every core field of the card is represented in the agent's data
- **THEN** the check passes
