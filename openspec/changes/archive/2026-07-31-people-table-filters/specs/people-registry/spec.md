## ADDED Requirements

### Requirement: The people list shows each person's career plan

The people list SHALL show the career plan each person is currently assigned, or a plain indication when they have none. The plan SHALL link to the **template** it was copied from, not to the person's own copy, since the copy is reachable from their card and what a list conveys is which track they are on.

#### Scenario: Opening the plan from the list

- **WHEN** a user clicks the career plan shown for a person
- **THEN** the plan template opens, showing the generic track rather than that person's copy

#### Scenario: A person with no plan

- **WHEN** a person has no active plan assignment
- **THEN** the list shows "ללא מסלול" without a link — wording chosen to differ from the framework column's "ללא שיוך", so two adjacent columns cannot read identically while meaning different things

#### Scenario: The template no longer exists

- **WHEN** a person's plan copy was created from a template that has since been deleted
- **THEN** the plan's name is still shown, without a link, rather than the row appearing to have no plan

### Requirement: Every column of the people list can be filtered

Each column of the people list SHALL be filterable, and the table SHALL narrow as the user types, without reloading the page. Columns holding open text — name, framework, recruitment date — SHALL match on a substring; columns holding a closed set — employment status, career plan — SHALL offer the values actually present, so a filter cannot be misspelled. Filters SHALL combine, and SHALL be clearable in one action.

#### Scenario: Filtering as you type

- **WHEN** a user types into a column's filter
- **THEN** the table narrows immediately, with no page reload

#### Scenario: Combining filters

- **WHEN** filters are set on more than one column
- **THEN** only people matching all of them are listed

#### Scenario: Filtering by a closed set

- **WHEN** a user filters by employment status or by career plan
- **THEN** they choose from the values present in their own view, rather than typing a value

#### Scenario: The count reflects the filtering

- **WHEN** any filter is active
- **THEN** the page states how many people are shown out of how many are visible to that user, and offers to clear the filters

#### Scenario: Filtering cannot widen visibility

- **WHEN** any combination of filters is applied
- **THEN** the result is a subset of the people that user was already permitted to see
