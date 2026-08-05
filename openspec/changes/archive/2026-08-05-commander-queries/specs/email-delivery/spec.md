## MODIFIED Requirements

### Requirement: A produced report can be sent to the user's own address

A report the system has produced — an answer on the questions page, or a rule's output — SHALL be sendable by email as markdown with a title. The destination SHALL be the address of the user the report belongs to, and no other: the signed-in asker for a question, the rule's owner for a rule. The system SHALL NOT offer a free-text destination.

Commander queries are the exception, and they travel in both directions: a query notification goes to the commander of each target framework, and an answer notification goes back to the commander of the sending framework. A query nobody is told about is not a query, and an answer the asker never hears about is not much of an answer.

Neither destination is free text. Both are resolved from the framework's commander at the moment of sending — never from who happened to write the query or the answer — and where a framework has no commander, no mail is attempted.

#### Scenario: Sending an answer

- **WHEN** a user sends an answer from the questions page
- **THEN** the markdown that the download button would produce is sent, with its title, to that user's own address

#### Scenario: A rule's output reaches its owner

- **WHEN** a rule marked to email on run completes
- **THEN** its output is sent to the rule's owner, whose page it is, and to nobody else

#### Scenario: A query notification reaches the receiving commander

- **WHEN** a commander sends a query to the frameworks beneath them
- **THEN** each target framework's current commander is emailed, at the address on their user record

#### Scenario: An answer notification reaches the asking commander

- **WHEN** a target commander answers a query
- **THEN** whoever commands the sending framework at that moment is emailed, naming the framework the answer came from

#### Scenario: No commander, no mail

- **WHEN** a target framework has no commander
- **THEN** no message is sent for it and the sender sees why on that framework's row

## ADDED Requirements

### Requirement: Query mail is sent after the response, and its outcome is kept

Mail for a query — the notification on sending, any reminder, and the notification of an answer — SHALL be dispatched after the response has been returned, so that a send to many frameworks does not hold up the form.

Because the sender is no longer waiting to hear the outcome, the outcome of each send SHALL be recorded against the target framework and shown in the query's list. A failure SHALL NOT be silent merely because it happened after the page was rendered.

#### Scenario: The form returns immediately

- **WHEN** a center commander sends a query to eight domains
- **THEN** the page returns without waiting for eight messages to be sent

#### Scenario: A failure is recorded rather than lost

- **WHEN** the mail for one target framework fails after the response was returned
- **THEN** the sender sees that failure on that framework's row the next time they view the query
