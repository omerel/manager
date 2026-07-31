## ADDED Requirements

### Requirement: Recurring occurrences come only from the plan, clipped by departure

The set of occurrences a person is measured against SHALL be derived solely from the recurring event's interval and its stop month in the plan. The system SHALL NOT apply any implicit horizon when a stop month is absent. When a person has an end-of-service date, their occurrences SHALL additionally be clipped at that date, for every recurring event regardless of how it is defined, so someone who has left does not accumulate overdue occurrences.

#### Scenario: No implicit horizon

- **WHEN** a recurring event has no stop month recorded
- **THEN** the system SHALL produce no occurrences for it and make that visible, rather than substituting a default number of months

#### Scenario: Departure clips the schedule

- **WHEN** a person with an end-of-service date at month 10 is assigned a recurring event that stops at month 24
- **THEN** occurrences after month 10 SHALL NOT be expected of them and SHALL NOT count as gaps

#### Scenario: No departure date recorded

- **WHEN** a person has no end-of-service date
- **THEN** their occurrences run to the plan's stop month, unchanged by the absence of that date

#### Scenario: Two people, one plan

- **WHEN** two serving people with no departure date are assigned the same plan
- **THEN** they are measured against exactly the same occurrences
