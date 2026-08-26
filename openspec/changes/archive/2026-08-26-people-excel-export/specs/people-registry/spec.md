# people-registry — delta

## ADDED Requirements

### Requirement: Exporting the registry to Excel

The people page SHALL offer an export of the registry as an `.xlsx` workbook. Before generating, the user SHALL choose which of the person card's values become columns — offered as the fixed core fields together with every Admin-defined card field, **all selected by default** — and SHALL be able to select or clear them all at once.

The export SHALL cover **every person the requesting user may see, regardless of any filter applied to the table on screen**, and the dialog SHALL state this so the difference is never discovered after the fact. The server SHALL determine that set from the requester's own visibility rather than from anything the request carries, so an export can never reveal a person the requester could not already open. Rows SHALL follow the same order the list uses; dates SHALL be written as Israeli dates; a value a person does not have SHALL be written as an empty cell. The export SHALL be recorded in the activity log.

#### Scenario: Exporting the whole visible registry

- **WHEN** a commander exports with the default selection while a filter narrows the table on screen
- **THEN** the workbook holds every person in their scope — not the filtered subset — one row each, with a header row of all card fields

#### Scenario: Choosing the columns

- **WHEN** the user clears some fields and exports
- **THEN** the workbook carries only the chosen columns, in the order the dialog presents them

#### Scenario: An export cannot widen visibility

- **WHEN** a Manager exports the registry
- **THEN** the workbook contains only people within their own visibility, whatever the request asked for

#### Scenario: Empty values stay empty

- **WHEN** an exported person has no value for a chosen field
- **THEN** that cell is empty in the workbook, rather than carrying a placeholder meant for the screen
