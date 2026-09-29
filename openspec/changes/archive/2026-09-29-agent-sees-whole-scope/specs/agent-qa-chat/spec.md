## MODIFIED Requirements

### Requirement: Interactive read-only Q&A over career data

The system SHALL provide a chat page (דף שאלות) where a user asks questions in natural language about people and careers, answered by the same read-only reasoning core as the rules engine. Answers are live and ephemeral, scoped to the user's visibility, and the agent MUST NOT modify any career data.

The data the agent reasons over SHALL cover **exactly the people the asker may see** — the same population, decided by the same rule, that the people list shows them. A person the asker can read on screen and the agent cannot read at all is a disagreement between two surfaces about one question, and the agent's silence about them is indistinguishable from their not existing.

A person belonging to no framework SHALL be no exception. Where the asker may see them, the agent SHALL carry them, reporting them as having no framework rather than omitting them.

#### Scenario: Asking about gaps

- **WHEN** a user asks "who is behind this year?"
- **THEN** the agent SHALL answer from current career data within the user's scope, without persisting or mutating any record

#### Scenario: Asking an aggregate question

- **WHEN** a user asks "how many finished their grant?"
- **THEN** the agent SHALL compute and return the answer over the current data in scope

#### Scenario: A person with no framework

- **WHEN** an Admin, who sees people belonging to no framework on the people list, asks the agent about one of them
- **THEN** the agent answers about that person, stating that they belong to no framework — it SHALL NOT answer as though no such person exists

#### Scenario: A count includes everyone the asker sees

- **WHEN** an Admin asks a question whose answer is a count over the people they can see
- **THEN** people belonging to no framework are counted, exactly as they are on the people list

#### Scenario: A scoped user is unaffected

- **WHEN** a Manager or an HR user asks the same question
- **THEN** the population the agent reasons over is unchanged — people outside every framework were never theirs to see, and still are not

### Requirement: The card and the agent's data are checked against each other

There SHALL be a check that compares the core fields of the person card against the data exported for the agent, and fails when a field exists in one and not the other.

The check SHALL be a comparison of the two, not an assertion about any particular field, so that a core field added to the card in future and not to the agent's data is caught rather than quietly missing.

The comparison SHALL run along **two axes, not one**: the fields each person carries, and the **people themselves**. A check that compares only fields can be complete and still miss an entire population — which is what happened: the agent's data was verified column by column while a whole class of people was absent from it, and nothing failed. For every user whose view is compared, the set of people the agent's data carries SHALL equal the set the user's own people list shows, and a difference in either direction SHALL fail the check naming the people concerned.

#### Scenario: A core field is added to the card only

- **WHEN** a core field is added to the person card and not to the agent's data
- **THEN** the check fails, naming the field

#### Scenario: Both are in step

- **WHEN** every core field of the card is represented in the agent's data
- **THEN** the check passes

#### Scenario: A person the user sees is missing from the agent's data

- **WHEN** a person appears on a user's people list and not in the data exported for that user's agent
- **THEN** the check fails, naming that person

#### Scenario: The agent's data reaches beyond the user's list

- **WHEN** the data exported for a user's agent carries a person their people list does not show
- **THEN** the check fails — the comparison guards both directions, an agent that over-reaches being worse than one that under-reaches
