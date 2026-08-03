## ADDED Requirements

### Requirement: An extracted date is read as an Israeli date, or not at all

The documents this system reads are Israeli, and a numeric date in them is day-first. The agent SHALL be told so, and every date it returns SHALL be interpreted day-first regardless of how it is punctuated.

An extracted date that cannot be parsed unambiguously SHALL NOT be proposed. It SHALL be omitted from the proposal so the reviewer sees a missing field and supplies it, rather than being shown a confidently wrong date on a screen designed to be approved quickly. The system SHALL NOT fall back to a month-first reading to rescue such a value.

#### Scenario: A document written the Israeli way

- **WHEN** a document gives a date as `03/08/2026` and the agent returns it
- **THEN** the proposed value is 3 August 2026

#### Scenario: A date the system cannot read

- **WHEN** the agent returns a date in a form the parser does not accept
- **THEN** that field is absent from the proposal, and no value is written for it

#### Scenario: No rescue by the American reading

- **WHEN** an extracted numeric date would only be valid if read month-first
- **THEN** it is refused rather than reinterpreted

#### Scenario: The reviewer still decides

- **WHEN** a date is successfully extracted and proposed
- **THEN** it is applied only after the reviewer approves that field, as with every other proposed field
