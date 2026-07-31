## ADDED Requirements

### Requirement: Gaps are measured against the active assignment only

Gap computation and every rollup SHALL consider a person's active plan assignment. Items belonging to an ended assignment SHALL NOT contribute to gap counts, whether they were met or not. Waived items of the active assignment SHALL NOT contribute either.

#### Scenario: After a transfer

- **WHEN** a person who was overdue on their previous plan is moved to a new one
- **THEN** those overdue items no longer count in their gap status or in any framework rollup

#### Scenario: Waived items do not create gaps

- **WHEN** the active assignment contains items waived because they predate it
- **THEN** they are excluded from the person's gap status and from rollup counts

#### Scenario: Live items still count

- **WHEN** an item of the active assignment falls after the waiver line and is unmet past its date
- **THEN** it counts as a gap exactly as before

### Requirement: An unmet item of an ended assignment is recorded as not done

An item that was required by an ended assignment and was never completed SHALL be presented as not done, distinctly from an item that was waived. A waived item was never required of the person; a not-done item was required and did not happen, and the two SHALL NOT be shown with the same mark.

#### Scenario: Reading a person's history

- **WHEN** a Manager views a person who has transferred
- **THEN** items left unmet on the previous plan are shown as not done, and are visibly distinct from items waived on the current plan

#### Scenario: Not done does not mean overdue

- **WHEN** an ended assignment contains unmet items
- **THEN** they appear in the person's history without being counted as current gaps
