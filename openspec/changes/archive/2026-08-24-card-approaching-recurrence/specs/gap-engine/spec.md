# gap-engine — delta

## MODIFIED Requirements

### Requirement: Gap prominence on the person card

The system SHALL surface a person's gaps prominently on their individual card so that time and value gaps are immediately visible. Every item kind the gap engine can mark as approaching — point events, cumulative metrics, and recurring occurrences — SHALL carry a visible approaching mark on the card, computed by the same rule the dashboard counts by.

#### Scenario: Viewing a person with gaps

- **WHEN** a manager opens a person who is 🔴 on two items
- **THEN** the card SHALL make those gaps visually prominent

#### Scenario: An approaching recurring occurrence is findable from the dashboard

- **WHEN** the dashboard counts a person 🟡 because an unfilled recurring occurrence falls within the approaching window
- **THEN** that occurrence's row on the person card is marked 🟡 «מתקרב», visually distinct from ordinary future occurrences
