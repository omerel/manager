## MODIFIED Requirements

### Requirement: Who may send and who receives

A commander SHALL be able to send a query to any set of commanded frameworks they choose. The frameworks exactly one level below the sender's own remain the default audience, offered pre-selected; the sender MAY remove any of them and MAY add the commander of any framework in the system — above, beside, or in another branch.

A team commander — the lowest level — SHALL NOT send queries. Any commander MAY receive one: receiving follows from being addressed, not from rank, so the for-me section exists for every commander, including a center commander.

A user who commands nothing SHALL have no access to this page at all.

#### Scenario: The default audience is one level down

- **WHEN** a domain commander opens the create form
- **THEN** the sections beneath their domain are listed as recipients, all selected, and sending without touching the list reaches exactly the audience it reached before recipients became choosable

#### Scenario: Narrowing the audience

- **WHEN** the sender unselects one of the default recipients
- **THEN** that framework receives nothing: no target row, no mail, no trace of the query

#### Scenario: Adding a commander from anywhere

- **WHEN** the sender uses ‎@‎ to add a commanded framework from another branch
- **THEN** that framework becomes a recipient like any other — its commander sees the query in their for-me section, answers, and is counted in the response tally

#### Scenario: A center commander can be addressed

- **WHEN** a section commander adds the center's framework as a recipient
- **THEN** the center commander receives the query in their for-me section and may answer it

#### Scenario: No recipients, no query

- **WHEN** the sender unselects every recipient and adds none
- **THEN** the send is refused, asking for at least one recipient

#### Scenario: A team commander still cannot send

- **WHEN** a team commander opens the page
- **THEN** they may answer queries addressed to them, and the create-query section is not offered

#### Scenario: A non-commander has no page

- **WHEN** a user who commands no framework opens the page
- **THEN** they are refused access

#### Scenario: The ‎@‎ offers only commanded frameworks

- **WHEN** the sender types ‎@‎ in the recipients field
- **THEN** only frameworks that currently have a commander are offered, labelled by full path and commander name — an explicitly added target nobody can answer would be a dead letter

#### Scenario: Recipients are validated on the server

- **WHEN** a submitted recipient is neither a direct child of the sender's framework nor a commanded framework
- **THEN** the send is refused, regardless of what the form displayed

## ADDED Requirements

### Requirement: The page is two panels, and finished queries fold away

The queries page SHALL present two panels side by side: the queries my framework sent, and the queries addressed to it — the latter titled "שאילתות עבורי", since a query may now arrive from any direction, not only from above. The search SHALL apply to both panels, and a side chooser SHALL narrow the page to either panel or show both.

Within each panel, open queries SHALL appear in full and first. A query that is no longer open — lapsed or closed early — SHALL collapse to a summary line marked with a green check, showing its title, its response tally and its deadline, and SHALL expand on demand to the full card with every action still available.

#### Scenario: Open before closed

- **WHEN** a panel holds open and closed queries
- **THEN** the open ones appear first as full cards, and the closed ones after as collapsed summary lines

#### Scenario: Expanding a closed query

- **WHEN** the reader expands a collapsed query
- **THEN** the full card appears with its answers and actions — reopening, deleting, reading — exactly as before it closed

#### Scenario: The side chooser

- **WHEN** a commander narrows the page to one side
- **THEN** only that panel is shown, and the choice survives a reload like the search does

#### Scenario: Search spans both panels

- **WHEN** a commander searches while both panels are shown
- **THEN** each panel narrows to its own matches

#### Scenario: The for-me panel is always present

- **WHEN** a commander has never been addressed by anyone
- **THEN** the for-me panel is shown empty with an explanation, rather than absent — its place on the page is fixed
