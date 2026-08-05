## ADDED Requirements

### Requirement: The agent can answer about the user's own queries

The questions page and the rules engine SHALL be able to answer about commander queries the signed-in user is a party to — those their framework sent and those it was asked — including titles, bodies, answers, deadlines and who has not responded.

This scope is a second axis, separate from career visibility: it follows the query relationship, not the org tree. The agent SHALL NOT be given a query the user is not a party to, even where the framework involved lies within their career visibility.

#### Scenario: Summarising answers received

- **WHEN** a domain commander asks "סכם לי את התשובות שקיבלתי על השאילתא האחרונה"
- **THEN** the agent answers from the answers to that query, which only they can see

#### Scenario: Asking who is late

- **WHEN** a commander asks which frameworks have not answered
- **THEN** the agent answers from the target rows of their own queries

#### Scenario: Another commander's exchange stays out of reach

- **WHEN** a center commander asks about queries a domain beneath them exchanged with its sections
- **THEN** the agent has no such data and says so, even though those frameworks are within the center commander's career visibility

#### Scenario: Career questions are unaffected

- **WHEN** a user asks a question about people and gaps
- **THEN** it is answered from career data scoped as before, unchanged by the presence of queries
