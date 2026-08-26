# people-registry — delta

## ADDED Requirements

### Requirement: The people list stays one screen tall

The people list SHALL NOT grow the page without bound. Its rows SHALL scroll within a bounded area, keeping the column headers and the filter row in view while the body scrolls, and SHALL render at most a fixed number of rows at a time — with a control revealing more, and a statement of how many of the matching people are currently shown.

Filtering SHALL continue to run over every person the user may see, never over the rendered subset alone: a match beyond the ceiling SHALL be found. Changing a filter SHALL reset the ceiling, so a narrowed result is shown from its beginning.

#### Scenario: A large registry does not produce an endless page

- **WHEN** a user opens the people list holding a thousand people
- **THEN** the page is about one screen tall, the rows scroll within their own area, and the headers and filters stay visible

#### Scenario: Revealing more rows

- **WHEN** more people match than are currently rendered
- **THEN** the list states how many of how many are shown and offers a control that reveals more

#### Scenario: A filter reaches beyond what is rendered

- **WHEN** a user filters for a person whose row is past the current ceiling
- **THEN** that person is found and shown, the ceiling having been reset by the filter change
