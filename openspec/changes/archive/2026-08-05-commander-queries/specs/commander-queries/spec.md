## ADDED Requirements

### Requirement: Who may send and who receives

A commander SHALL be able to send a query to the frameworks exactly one level below the framework they command, and to no other framework. Because the org tree is strictly layered, this follows from the commanded framework's kind: a center commander sends only, a team commander receives only, and domain and section commanders do both.

A user who commands nothing SHALL have no access to this page at all.

#### Scenario: A domain commander sends downward

- **WHEN** a domain commander creates a query
- **THEN** it is addressed to every section directly beneath their domain, and to nothing deeper or sideways

#### Scenario: A team commander cannot send

- **WHEN** a team commander opens the page
- **THEN** they may answer queries addressed to them, and the create-query section is not offered

#### Scenario: A center commander has no superior

- **WHEN** a center commander opens the page
- **THEN** they see their own sent queries, and no superior-level section

#### Scenario: A non-commander has no page

- **WHEN** a user who commands no framework opens the page
- **THEN** they are refused access

#### Scenario: A framework with no children

- **WHEN** a section commander whose section has no teams tries to send a query
- **THEN** the send is refused, explaining there is no one a level below to address

### Requirement: A query is addressed to frameworks, not to people

A query SHALL record the sending framework and one target row per receiving framework. The users who wrote the query and each answer SHALL be recorded as authors, and SHALL NOT determine who may act on the query afterwards. Whoever commands a target framework at the moment of answering SHALL be the one who may answer it.

A target framework with no commander SHALL be shown to the sender as a row nobody can fill, naming the framework.

#### Scenario: The commander is replaced mid-query

- **WHEN** the commander of a target framework is replaced while a query is open
- **THEN** the new commander sees the query awaiting an answer, and may answer it

#### Scenario: A commander is appointed after the query was sent

- **WHEN** a framework had no commander when a query was sent, and one is appointed before the deadline
- **THEN** that commander sees the query and may answer it

#### Scenario: The sender is replaced

- **WHEN** the commander of the sending framework is replaced
- **THEN** the new commander sees the queries their framework has sent, with all answers received

#### Scenario: A framework with no commander is visible as such

- **WHEN** a target framework has no commander
- **THEN** the sender's list shows that framework as unanswerable, naming it

### Requirement: A query carries a title, a body and a deadline

A query SHALL consist of a title, a short body, and a date by which it must be answered. The deadline SHALL be inclusive: a query due on a given date may be answered through the end of that date.

#### Scenario: Answering on the deadline date

- **WHEN** a commander answers a query on its due date
- **THEN** the answer is accepted

### Requirement: Answering, revising, and the deadline

While a query is open, the receiving commander SHALL be able to answer it, revise the answer, and submit again. The sender SHALL see the current answer in place, together with the date it was last changed when it has been revised.

Once a query is no longer open — the deadline passed, or the sender closed it early — it SHALL be read-only for the receiver: neither a first answer nor a revision SHALL be accepted.

#### Scenario: Revising before the deadline

- **WHEN** a commander who already answered submits a different answer before the deadline
- **THEN** the new answer replaces the old one and the sender sees it, marked with the date it changed

#### Scenario: A first answer is unmarked

- **WHEN** a commander answers for the first time
- **THEN** the sender sees the answer without a "changed on" date, because nothing changed

#### Scenario: The deadline has passed

- **WHEN** a commander opens a query whose deadline has passed
- **THEN** they can read it and their own answer, and can no longer write

#### Scenario: A non-responder after the deadline

- **WHEN** the deadline passes with no answer from a framework
- **THEN** that framework is shown to the sender as not having responded, and can no longer answer

### Requirement: The deadline may be moved, and open is derived

The sender SHALL be able to change a query's deadline at any time. A deadline SHALL NOT be set to a date that has already passed: such an entry SHALL be refused with an ordinary validation message that points at the close action, and the date chooser SHALL NOT offer past days.

Whether a query is open SHALL be derived, never stored as a status:

> open ⟺ it has not been closed early AND today ≤ its deadline

Extending the deadline of a query that had lapsed SHALL reopen it for every target, including those that never answered and those who wish to revise. Receivers SHALL be shown that a deadline has been changed.

#### Scenario: Extending a lapsed query

- **WHEN** the sender extends the deadline of a query whose date had passed with some targets unanswered
- **THEN** the query is open again, non-responders may answer, and those who answered may revise

#### Scenario: A past deadline is refused, not turned into a closure

- **WHEN** the sender enters a deadline earlier than today
- **THEN** the entry is refused with a message naming the date and directing them to the close action, and neither the deadline nor the query's state changes

#### Scenario: The chooser will not offer a past day

- **WHEN** the sender opens the deadline's calendar
- **THEN** days before today are not selectable

#### Scenario: A moved deadline is visible

- **WHEN** a query's deadline has been changed
- **THEN** receivers see the current deadline together with the fact that it was changed

### Requirement: The sender may close a query early, and undo it

The sender SHALL be able to close a query before its deadline — when enough answers have arrived, or when waiting is no longer worthwhile. Closing SHALL ask for confirmation first, stating how many targets have answered and how many will lose the chance to.

Closing SHALL record that the query was ended early. It SHALL NOT alter the deadline: the date the recipients were given remains what it was, and a closed query is shown as closed by the sender rather than as lapsed.

The sender SHALL be able to reopen a query they closed. Reopening SHALL restore whatever the deadline says, and SHALL NOT resurrect a query whose deadline has since passed on its own.

#### Scenario: Closing on partial answers

- **WHEN** three of five targets have answered and the sender closes the query
- **THEN** the query is closed, the two remaining targets can no longer answer, and the three answers are kept

#### Scenario: The confirmation states the cost

- **WHEN** the sender closes a query with targets still unanswered
- **THEN** the confirmation names how many have answered and how many have not

#### Scenario: The stated deadline survives the closure

- **WHEN** a query due in a week is closed today
- **THEN** its deadline still reads as that date, and it is shown as closed by the sender

#### Scenario: A receiver is told which it was

- **WHEN** a target opens a query the sender closed early
- **THEN** they are told the sender closed it, not that a date passed

#### Scenario: Reopening

- **WHEN** the sender reopens a query they closed, whose deadline has not passed
- **THEN** targets may answer again, and any answer already given is still there

#### Scenario: Reopening does not override the deadline

- **WHEN** the sender reopens a query whose deadline has since passed
- **THEN** the query stays shut, because the deadline and not the closure is now what holds it

### Requirement: The query body is frozen once anyone has answered

The title and body SHALL be editable while no target has answered, and SHALL be frozen from the first answer onward. The deadline SHALL remain editable regardless.

#### Scenario: Editing before any answer

- **WHEN** the sender edits the title of a query no one has answered
- **THEN** the edit is accepted

#### Scenario: Editing after an answer

- **WHEN** the sender tries to edit the body of a query that has at least one answer
- **THEN** the edit is refused, explaining that answers already exist, while the deadline remains editable

### Requirement: Only the asking and the answering framework see a query

A query and its answers SHALL be visible only to the framework that sent it and to the framework it was addressed to. A target SHALL NOT see the answers of its sibling targets. A commander above the sender SHALL NOT see queries the sender issued or received. The Admin SHALL NOT see other users' queries, on the same footing as the private rules page.

#### Scenario: Siblings are blind to each other

- **WHEN** a section commander opens a query sent to their section
- **THEN** they see their own answer only, and not the answers of other sections asked the same query

#### Scenario: The level above is blind

- **WHEN** a center commander opens the page
- **THEN** they see the queries their center sent and nothing about queries exchanged between a domain and its sections

#### Scenario: The Admin is blind

- **WHEN** the Admin opens the page
- **THEN** they see only queries their own commanded framework sent or received, and no others

### Requirement: The sender may delete a query

The sender SHALL be able to delete a query they issued. Deleting SHALL remove every recipient's copy along with it, so no target row outlives the question it belonged to, and SHALL destroy any answers already given.

Deletion SHALL ask for confirmation first, naming how many answers are about to be lost, or how many frameworks will lose the query where none has answered. Deleting a query SHALL NOT affect the frameworks or the people involved.

#### Scenario: Deleting removes it from everyone

- **WHEN** the sender deletes a query
- **THEN** it disappears from the recipients' pages as well as their own, and no target row remains

#### Scenario: The confirmation names the cost

- **WHEN** the sender deletes a query that has answers
- **THEN** the confirmation states how many answers will be destroyed

#### Scenario: Nothing else is touched

- **WHEN** a query is deleted
- **THEN** the frameworks at both ends, their commanders, and any tagged people are unaffected

### Requirement: The asker is told when an answer arrives

When a target answers, the sender SHALL be notified twice over: the answer SHALL be marked as new until the sender next opens the page, and the commander of the sending framework SHALL be emailed that an answer has arrived, naming the framework it came from.

A revision SHALL notify in the same way as a first answer, distinguished as an update, because a changed answer is news too.

"New since I last looked" SHALL be recorded per answer, not inferred from timestamps, and SHALL be cleared only after the sender's page has been served — never while it is being rendered.

#### Scenario: An answer is marked new

- **WHEN** a target answers a query
- **THEN** the sender's list marks that answer as new, and the queries badge counts it

#### Scenario: The asker is emailed

- **WHEN** a target answers
- **THEN** the commander of the sending framework is emailed, naming the answering framework and carrying the answer

#### Scenario: Reading clears it

- **WHEN** the sender opens the queries page and it lists the new answer
- **THEN** the answer is shown as new on that visit, and is no longer new on the next

#### Scenario: A revision is news again

- **WHEN** a target revises an answer the sender had already read
- **THEN** it is marked new again and the sender is emailed about the update

#### Scenario: The badge carries two meanings

- **WHEN** a commander has queries awaiting their answer and unread answers to their own
- **THEN** the badge shows the sum, and names both parts

### Requirement: Queries can be searched

The queries page SHALL offer a search over both the queries sent and those received, matching the title, the body, the answers, and the name of the framework at the other end. A search that matches nothing SHALL say so, distinguishing it from having no queries at all.

#### Scenario: Searching by answer text

- **WHEN** a commander searches for a phrase that appears only in an answer they received
- **THEN** the query carrying that answer is listed

#### Scenario: Searching by framework

- **WHEN** a commander searches for a framework name
- **THEN** queries exchanged with that framework are listed

#### Scenario: No matches

- **WHEN** a search matches nothing
- **THEN** the page says nothing matched that search, rather than appearing to hold no queries

### Requirement: Reminders

On sending a query, each target framework's commander SHALL be emailed that a query awaits them and by when. While a commander has an unanswered query, the interface SHALL show them a marker with the number outstanding.

The sender SHALL be able to send a reminder by hand to targets that have not answered, and SHALL NOT be able to remind those that have.

Email delivery SHALL happen after the response rather than blocking it, and the outcome of each send SHALL be recorded on the target row so a failure is visible rather than silent.

#### Scenario: Notified on send

- **WHEN** a query is sent to three frameworks with commanders
- **THEN** each of the three commanders is emailed the title and the deadline

#### Scenario: A framework with no commander cannot be emailed

- **WHEN** a target framework has no commander
- **THEN** no mail is attempted for it and the row shows why

#### Scenario: The outstanding marker

- **WHEN** a commander has two unanswered queries
- **THEN** the interface shows them a marker with a count of two, which clears as they answer

#### Scenario: Reminding a non-responder

- **WHEN** the sender sends a reminder to a framework that has not answered
- **THEN** that commander is emailed again and the row records when it was last reminded

#### Scenario: A failed send is visible

- **WHEN** the mail for one target fails
- **THEN** the sender sees the failure on that target's row rather than assuming it arrived

### Requirement: A person can be tagged in a query or an answer

Typing `@` while writing a query or an answer SHALL offer the people the writer can see, and choosing one SHALL insert a tag referring to that person. A tag SHALL record the person's identity, not merely their name.

A tag SHALL render as a link to that person's page, opening in a new tab so the query being read is not lost. Where the reader may not see the tagged person, the name SHALL be shown as plain text rather than as a link that would lead nowhere.

Because a tag records identity, a person renamed after being tagged SHALL appear under their current name. A person who no longer exists SHALL appear under the name recorded when they were tagged, so the sentence still reads.

Wherever the text is read rather than rendered — the notification email, and the copy the agent reasons over — tags SHALL be flattened to a plain `@name`.

#### Scenario: Tagging while writing

- **WHEN** a commander types `@` in a query or an answer and picks a person
- **THEN** a tag for that person is inserted, and the people offered are only those the writer can see

#### Scenario: Following a tag

- **WHEN** a reader who can see the tagged person clicks the tag
- **THEN** that person's page opens in a new tab

#### Scenario: A reader without access

- **WHEN** a reader who cannot see the tagged person reads the text
- **THEN** the name appears as plain text and no link is offered

#### Scenario: The person is renamed

- **WHEN** a person is renamed after being tagged
- **THEN** the tag shows their current name

#### Scenario: The person is deleted

- **WHEN** a tagged person no longer exists
- **THEN** the name recorded at the time of writing is shown as plain text

#### Scenario: Mail and the agent get plain text

- **WHEN** a query containing a tag is emailed, or read by the agent
- **THEN** the tag appears as `@name`, with no markup
