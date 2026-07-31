## MODIFIED Requirements

### Requirement: The dataset exercises the whole range of system states

Generated people SHALL span the states the system is meant to distinguish, rather than being uniform: a spread of gap states across 🟢 / 🟡 / 🔴, people with no assigned plan, people who have left with an end-of-service date, and **people who have transferred between plans — with a retained previous assignment, waived items on the current one, and at least one carried-over metric or milestone**. Career plans SHALL differ in shape — one led by point events, one by cumulative metrics, one by recurring evaluations — and in horizon.

#### Scenario: The dashboard is not monochrome

- **WHEN** an Admin opens the gap dashboard after generation
- **THEN** the rollup shows people in more than one gap state, and frameworks that differ from one another in their counts

#### Scenario: Unplanned and departed people are present

- **WHEN** the generated people are listed
- **THEN** some have no career plan assigned, and some have an end-of-service date

#### Scenario: Transferred people are present

- **WHEN** the generated people are listed
- **THEN** some have an ended plan assignment alongside their active one, with waived items and at least one carried-over value, so the transfer feature has data to exercise it

#### Scenario: Plans differ in kind

- **WHEN** the generated career plans are opened
- **THEN** each presents a different mix of point events, cumulative metrics and recurring events, and their diagrams differ in the number of event months they span
