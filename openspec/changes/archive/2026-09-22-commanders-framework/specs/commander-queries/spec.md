## MODIFIED Requirements

### Requirement: Who may send and who receives

A commander SHALL be able to send a query to any set of commanded frameworks they choose. The frameworks exactly one level below the sender's own remain the default audience, offered pre-selected; the sender MAY remove any of them and MAY add the commander of any framework in the system — above, beside, or in another branch.

A commanders framework SHALL NOT be a recipient of a query, and SHALL NOT appear in the default audience even when it is a direct child of the sending framework. It has no commander of its own — the commander answerable for it is the commander of its parent, who is the sender — so a row for it would be a row nobody could fill.

A team commander — the lowest level — SHALL NOT address frameworks; their only sending channel is the HR user who tends their framework, defined in its own requirement. Any commander MAY receive a query: receiving follows from being addressed, not from rank, so the for-me section exists for every commander, including a center commander.

A user who neither commands a framework nor holds a correspondent identity of their own SHALL have no access to this page at all.

#### Scenario: The default audience is one level down

- **WHEN** a domain commander opens the create form
- **THEN** the sections beneath their domain are listed as recipients, all selected, and sending without touching the list reaches exactly the audience it reached before recipients became choosable

#### Scenario: A commanders framework is not offered as a recipient

- **WHEN** a domain commander whose domain holds a commanders framework opens the create form
- **THEN** the sections beneath the domain are listed, the commanders framework is not, and no unanswerable row appears

#### Scenario: A commanders framework cannot be added by hand

- **WHEN** a commander searches the framework picker for a commanders framework in any branch
- **THEN** it is not among the choices, having no commander to answer

#### Scenario: A user who commands nothing and is not a correspondent

- **WHEN** a Manager who commands no framework opens the page
- **THEN** they are told the page is not for them, and see no queries
