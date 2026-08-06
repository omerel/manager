## ADDED Requirements

### Requirement: The dashboard can be narrowed to one framework

The dashboard SHALL offer a chooser of the frameworks in the viewer's visibility, identified by their full path through the tree. Choosing one SHALL narrow the whole dashboard to that framework's subtree: the compliance gauge, the event tiles, the per-framework comparison, the needs-attention list and the org tree SHALL all be counted within it.

A chosen framework that is no longer visible — deleted, or no longer granted — SHALL be treated as no choice at all: the dashboard SHALL fall back to the viewer's full scope and say so, rather than failing.

#### Scenario: Narrowing to a framework

- **WHEN** a manager chooses a domain from the chooser
- **THEN** every figure on the dashboard is counted within that domain and its descendants, and nothing outside it is included

#### Scenario: The chooser disambiguates repeated names

- **WHEN** two frameworks in different branches share a name
- **THEN** the chooser distinguishes them by their full path

#### Scenario: A framework that has gone away

- **WHEN** a manager opens a saved link naming a framework they can no longer see
- **THEN** the dashboard shows their full scope with a note explaining the chosen framework is unavailable

#### Scenario: A framework with no sub-frameworks

- **WHEN** the chosen framework is a team, which has no children
- **THEN** the per-framework comparison says there is nothing to compare rather than appearing empty

### Requirement: The dashboard can be narrowed to a kind of gap

The dashboard SHALL offer a choice of gap kind — approaching, overdue, or all — which SHALL narrow the lists of people: the needs-attention panel and the people listed under each team in the org tree.

The compliance gauge and the per-framework comparison SHALL NOT change with this choice. They SHALL continue to measure overdue in every case, so that a single figure on the dashboard never means two different things depending on a control that may have been forgotten.

"All" SHALL mean no narrowing, expressed in each list's own terms: the tree keeps every person including those meeting their plan, and the needs-attention panel carries both the overdue and the approaching.

#### Scenario: Narrowing to approaching

- **WHEN** a manager chooses approaching
- **THEN** the needs-attention panel lists the people with an approaching item, and the tree lists only those people under each team

#### Scenario: The headline figure does not move

- **WHEN** a manager switches between approaching, overdue and all
- **THEN** the compliance gauge and the per-framework bars show the same figures throughout

#### Scenario: All keeps the tree whole

- **WHEN** the choice is all
- **THEN** the tree lists every person under a team, including those meeting their plan

#### Scenario: All widens the needs-attention panel

- **WHEN** the choice is all
- **THEN** the needs-attention panel lists both the overdue and the approaching, distinguished from each other

#### Scenario: Overdue reproduces the earlier behaviour

- **WHEN** the choice is overdue
- **THEN** the needs-attention panel lists exactly the people it listed before this capability existed

### Requirement: The dashboard's narrowing survives a reload and a link

The chosen framework and gap kind SHALL be carried in the page's address, so that reloading preserves them, the browser's back button steps through them, and a link can be sent to another person who may see the same view within their own visibility.

A link SHALL NEVER widen what its recipient can see: the narrowing is applied within the recipient's own visibility.

#### Scenario: Reloading

- **WHEN** a manager narrows the dashboard and reloads the page
- **THEN** the same narrowing is still in effect

#### Scenario: A link does not widen visibility

- **WHEN** a manager opens a link naming a framework outside their visibility
- **THEN** they see their own full scope, and no data from that framework
