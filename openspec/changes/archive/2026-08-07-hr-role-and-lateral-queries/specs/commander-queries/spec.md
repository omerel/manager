## ADDED Requirements

### Requirement: An HR user asks laterally within their granted subtree

An HR user SHALL be able to send a query, and the sender SHALL be the HR user themselves rather than any framework. The recipients they may choose SHALL be every commanded framework inside the subtrees they hold access grants over, at any depth, including a granted node itself; several grants SHALL present as one list.

None of the chain rules SHALL apply to them: no audience SHALL be pre-selected, no recipient outside their granted subtrees SHALL be reachable, and a commanded team SHALL be addressable — the refusal of teams is about sending from one, not about being sent to.

A framework with no commander SHALL NOT be offered to an HR user, since a row nobody can answer only distorts the tally for a sender who is outside the chain and has no pressure to apply.

An HR user SHALL be able to act on the queries they sent exactly as a sending commander can — editing, moving the deadline, reminding, closing, reopening and deleting.

#### Scenario: The recipient list is the granted subtree

- **WHEN** an HR user granted over a domain opens the create form
- **THEN** every commanded framework beneath that domain is offered at any depth, including the domain itself, and nothing outside it

#### Scenario: Nothing is pre-selected

- **WHEN** an HR user opens the create form
- **THEN** no recipient is selected in advance, and sending without choosing anyone is refused

#### Scenario: A commanded team can be asked

- **WHEN** an HR user selects a commanded team inside their subtree
- **THEN** that team's commander receives the query and may answer it

#### Scenario: Uncommanded frameworks are not offered

- **WHEN** a framework inside the HR user's subtree has no commander
- **THEN** it does not appear in their recipient list at all

#### Scenario: Reach outside the subtree is refused

- **WHEN** a request to send names a framework outside every subtree the HR user is granted over
- **THEN** the system SHALL refuse it on the server, whatever the form offered

#### Scenario: The HR sender acts on their own query

- **WHEN** an HR user closes, reopens, edits or deletes a query they sent
- **THEN** the system SHALL accept it, and SHALL refuse the same act from anyone else including the commander of the framework they are granted over

### Requirement: A lateral request is presented as coming from a person

Where a query sent by a framework is presented to its recipient as coming from that framework, a query sent by an HR user SHALL be presented as coming from that person, named as משא״ן. This SHALL hold both on the page and in the notification mail.

#### Scenario: The recipient sees a person

- **WHEN** a commander opens a query an HR user sent them
- **THEN** the from-line names משא״ן and the person, and never the framework the request was made under

#### Scenario: The mail matches the page

- **WHEN** the notification mail for that query is sent
- **THEN** it names the sender the same way the page does

#### Scenario: Answering is unchanged

- **WHEN** a commander answers a query from an HR user
- **THEN** they answer as their framework exactly as they would answer a commander, and are counted in the tally the same way

### Requirement: An HR user only asks

An HR user's query page SHALL show one panel — the queries they sent. The panel of queries addressed to them SHALL NOT be present, since no framework addresses a person; it SHALL be absent rather than shown empty.

#### Scenario: One panel

- **WHEN** an HR user opens the query page
- **THEN** they see only the queries they sent, with no for-me panel and no side chooser offering one

#### Scenario: Nobody addresses an HR user

- **WHEN** a commander opens their own recipient chooser
- **THEN** no HR user appears in it; recipients are frameworks

### Requirement: Deleting a user closes the queries they sent as a person

Deleting a user SHALL close every open query that user sent as a person, rather than deleting it or leaving it open. The correspondence and the answers written to it SHALL remain readable to the frameworks that answered.

Queries sent by a framework SHALL be unaffected: they belong to the framework and outlive whoever wrote them.

#### Scenario: An HR user is deleted with queries open

- **WHEN** an HR user who has open queries is deleted
- **THEN** those queries are closed, their answers remain readable to the recipients, and nothing is left that no one can act on

#### Scenario: A commander is deleted

- **WHEN** a user who commanded a framework is deleted
- **THEN** the queries their framework sent remain open and pass to whoever commands it next

## MODIFIED Requirements

### Requirement: Who may send and who receives

A commander SHALL be able to send a query to any set of commanded frameworks they choose. The frameworks exactly one level below the sender's own remain the default audience, offered pre-selected; the sender MAY remove any of them and MAY add the commander of any framework in the system — above, beside, or in another branch.

A team commander — the lowest level — SHALL NOT send queries. Any commander MAY receive one: receiving follows from being addressed, not from rank, so the for-me section exists for every commander, including a center commander.

A user who neither commands a framework nor holds a correspondent identity of their own SHALL have no access to this page at all.

#### Scenario: The default audience is one level down

- **WHEN** a domain commander opens the create form
- **THEN** the sections beneath their domain are listed as recipients, all selected, and sending without touching the list reaches exactly the audience it reached before recipients became choosable

#### Scenario: A user who commands nothing and is not a correspondent

- **WHEN** a Manager who commands no framework opens the page
- **THEN** they are told the page is not for them, and see no queries

### Requirement: A query records the kind of correspondent that sent it

A query SHALL record the sending framework and one target row per receiving framework. The users who wrote the query and each answer SHALL be recorded as authors.

A query SHALL also record **which kind of correspondent sent it** — a framework, or a person acting laterally. This SHALL be stored when the query is created and SHALL NOT be inferred afterwards from the author's role, so that a correspondence means the same thing after the author's role changes as it did when it was written.

For a query sent by a framework, the author SHALL NOT determine who may act on it afterwards: whoever commands the sending framework at the moment may act, and whoever commands a target framework at the moment of answering may answer. For a query sent by a person, the author IS the correspondent and SHALL be the only one who may act on it.

Whether a user is the sender of a given query SHALL be decided by one definition, read by every guard and every listing that asks.

A target framework with no commander SHALL be shown to a sending commander as a row nobody can fill, naming the framework.

#### Scenario: The commander is replaced mid-query

- **WHEN** the commander of a target framework is replaced while a query is open
- **THEN** the new commander sees the query awaiting an answer, and may answer it

#### Scenario: A commander is appointed after the query was sent

- **WHEN** a framework had no commander when a query was sent, and one is appointed before the deadline
- **THEN** that commander sees the query and may answer it

#### Scenario: The sender is replaced

- **WHEN** the commander of a framework that sent a query is replaced
- **THEN** the new commander sees the queries their framework has sent, with all answers received

#### Scenario: A lateral query does not change hands

- **WHEN** the commander of the framework an HR user was granted over is replaced
- **THEN** the new commander sees nothing of that HR user's queries; they belong to the person, not to the framework

#### Scenario: The recorded kind survives a role change

- **WHEN** an HR user who sent queries is later made a Manager, or a Manager who sent queries is made an HR user
- **THEN** every query they sent keeps the sender it had, and no correspondence changes hands

#### Scenario: A framework with no commander is visible as such

- **WHEN** a target framework has no commander and the sender is a commander
- **THEN** the sender's list shows that framework as unanswerable, naming it

### Requirement: Only the asking and the answering framework see a query

A query and its answers SHALL be visible only to the correspondent that sent it and to the framework it was addressed to. A target SHALL NOT see the answers of its sibling targets. A commander above the sender SHALL NOT see queries the sender issued or received. The Admin SHALL NOT see other users' queries, on the same footing as the private rules page.

#### Scenario: Siblings are blind to each other

- **WHEN** a section commander opens a query sent to their section
- **THEN** they see their own answer only, and not the answers of other sections asked the same query

#### Scenario: The level above is blind

- **WHEN** a center commander opens the page
- **THEN** they see the queries their center sent and nothing about queries exchanged between a domain and its sections

#### Scenario: The Admin is blind

- **WHEN** the Admin opens the page
- **THEN** they see only queries their own commanded framework sent or received, and no others

#### Scenario: An HR user's correspondence is their own

- **WHEN** any user other than the HR sender and the addressed commanders opens the page
- **THEN** they see nothing of that query, including the commander of the framework the HR user is granted over

### Requirement: The page is two panels for a commander, one for a person

The query page SHALL present two panels side by side to a commander: the queries their framework sent, and the queries addressed to it — the latter titled "שאילתות עבורי", since a query may arrive from any direction, not only from above. The search SHALL apply to both panels, and a side chooser SHALL narrow the page to either panel or show both.

To an HR user the page SHALL present a single panel, with no side chooser.

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

#### Scenario: No chooser for one panel

- **WHEN** an HR user opens the page
- **THEN** a single panel is shown and no side chooser appears, there being no second side to choose

## RENAMED Requirements

- FROM: `### Requirement: A query is addressed to frameworks, not to people`
- TO: `### Requirement: A query records the kind of correspondent that sent it`
- FROM: `### Requirement: The page is two panels, and finished queries fold away`
- TO: `### Requirement: The page is two panels for a commander, one for a person`
