# hr-workspace — delta

## ADDED Requirements

### Requirement: The service-end date is a mappable core column

The table import and the external update SHALL offer «תאריך סיום שירות» (`endOfServiceDate`) as a mapping target alongside the other core card fields — in the mapping editor, in automatic header recognition, and in the agent's mapping vocabulary. The value is an OPTIONAL, NULLABLE date: an absent or unreadable value never blocks a row (it is dropped with a warning where a value was present), a created person may carry none, and — the column being nullable — the external update SHALL treat an emptied cell as a proposed deletion, approved per field like any other proposal.

#### Scenario: Mapping the column in an import

- **WHEN** an imported file carries a column whose header names the service-end date (e.g. «תאריך סיום שירות», «תת״ש»)
- **THEN** recognition maps it automatically, the mapping editor offers it as an option, and an approved import writes the date onto the created people

#### Scenario: The optional date follows the soft rule

- **WHEN** a row's service-end value is empty or unreadable
- **THEN** the row still creates its person — without the value, and with a warning where an unreadable value was dropped

#### Scenario: The external update can clear it

- **WHEN** a weekly update file shows an emptied service-end cell for a person whose card carries a date
- **THEN** the review proposes a deletion for that field, and approving it clears the date from the card
