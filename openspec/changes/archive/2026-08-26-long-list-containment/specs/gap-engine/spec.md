# gap-engine — delta

## ADDED Requirements

### Requirement: The dashboard tree contains its own lists

A team's people list in the dashboard's org tree SHALL scroll within a bounded area rather than stretching the page, so that the tree's structure — the frameworks and their rolled-up counts — remains navigable however many people hang beneath one team.

#### Scenario: A large team does not bury the tree

- **WHEN** the dashboard tree is expanded over a team holding hundreds of people
- **THEN** that team's people scroll within their own area, and the frameworks below it remain reachable without scrolling past every person
