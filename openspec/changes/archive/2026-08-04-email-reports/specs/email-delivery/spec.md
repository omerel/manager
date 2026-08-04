## ADDED Requirements

### Requirement: A produced report can be sent to the user's own address

A report the system has produced — an answer on the questions page, or a rule's output — SHALL be sendable by email as markdown with a title. The destination SHALL be the address of the user the report belongs to, and no other: the signed-in asker for a question, the rule's owner for a rule. The system SHALL NOT offer a free-text destination.

#### Scenario: Sending an answer

- **WHEN** a user sends an answer from the questions page
- **THEN** the markdown that the download button would produce is sent, with its title, to that user's own address

#### Scenario: A rule's output reaches its owner

- **WHEN** a rule marked to email on run completes
- **THEN** its output is sent to the rule's owner, whose page it is, and to nobody else

### Requirement: Delivery runs through a replaceable script

Sending SHALL be performed by invoking `emailer.py` with `--title`, `--body` and `--to`. A result of **201** SHALL mean sent; anything else SHALL mean failed. The system SHALL treat this interface as the contract and SHALL NOT depend on how the script delivers.

The script shipped with the system SHALL be a stand-in that performs no delivery, states in the file that the target environment replaces it, and exercises both outcomes. Its outcome SHALL be forceable so that automated verification can assert the success and failure paths rather than depend on chance.

The runtime image SHALL contain the interpreter the script needs, so that the feature behaves the same in development and in the delivered image.

#### Scenario: A successful send

- **WHEN** the script returns 201
- **THEN** the system reports the report as sent

#### Scenario: Any other result

- **WHEN** the script returns anything other than 201, or cannot be run at all
- **THEN** the system reports the send as failed and does not claim it succeeded

#### Scenario: The script is replaced

- **WHEN** the target environment overwrites the script with a real implementation honouring the same flags and the 201 convention
- **THEN** no change to the system is required for mail to be delivered

### Requirement: A failed send is shown, never swallowed

A send that fails SHALL be visible to the user it concerns. For an action the user just took, the failure SHALL appear in response to that action. For a run that happened on a schedule, the failure SHALL be recorded against that run and visible where its output is read, so the owner never believes a report went out when it did not.

#### Scenario: Failing while the user watches

- **WHEN** a user presses send and the send fails
- **THEN** the page tells them it failed, next to the control they used

#### Scenario: Failing with nobody watching

- **WHEN** a scheduled rule's email fails
- **THEN** the failure is recorded on that run and shown on the rules page, rather than passing silently

#### Scenario: A report too large to pass to the script

- **WHEN** a report exceeds what can be handed to the script
- **THEN** the send fails with a reason that says so, rather than an unexplained error
