## ADDED Requirements

### Requirement: Organizational hierarchy

The system SHALL model a strict four-level organizational tree with people as leaves: `center (מרכז) ▸ domain (תחום) ▸ section (מדור) ▸ team (צוות) ▸ person (איש)`. Each non-root node MUST have exactly one parent, and every person MUST be placed under exactly one team.

#### Scenario: Placing a person in the tree

- **WHEN** a manager assigns a person to a team
- **THEN** the person inherits a unique path `center ▸ domain ▸ section ▸ team` derived from that team's position in the tree

#### Scenario: Rejecting an incomplete placement

- **WHEN** a manager tries to place a person under a node that is not a team (e.g. directly under a domain)
- **THEN** the system SHALL reject the placement and require a team-level node

### Requirement: Rollup aggregation up the tree

The system SHALL aggregate person-level metrics (such as gap counts) upward to team, section, domain, and center levels, so that any node reports the totals of all people beneath it.

#### Scenario: Aggregating gaps to a domain

- **WHEN** a domain contains sections, teams, and people with a total of N people in gap state 🔴
- **THEN** the domain node SHALL report N as its rolled-up 🔴 count, equal to the sum of its descendant teams' counts

#### Scenario: Drilling down from an aggregate

- **WHEN** a manager selects a rolled-up count at any tree level
- **THEN** the system SHALL let them drill down to the underlying people that contributed to that count
