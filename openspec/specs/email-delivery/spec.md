# email-delivery

## Purpose

שליחת דוח שהמערכת הפיקה לכתובת המייל של בעליו: מה נשלח, למי, ואיך כישלון שליחה מוצג.

## Requirements

### Requirement: A produced report can be sent to the user's own address

A report the system has produced — an answer on the questions page, or a rule's output — SHALL be sendable by email as markdown with a title. The destination SHALL be the address of the user the report belongs to, and no other: the signed-in asker for a question, the rule's owner for a rule. The system SHALL NOT offer a free-text destination.

#### Scenario: Sending an answer

- **WHEN** a user sends an answer from the questions page
- **THEN** the markdown that the download button would produce is sent, with its title, to that user's own address

#### Scenario: A rule's output reaches its owner

- **WHEN** a rule marked to email on run completes
- **THEN** its output is sent to the rule's owner, whose page it is, and to nobody else

### Requirement: Delivery runs through a replaceable script

Sending SHALL be performed by invoking `emailer.py` with `--title`, `--body` and `--to`. The script SHALL report its outcome as a **boolean on standard output — `1` for sent, `0` for failed — as the last non-empty line it prints**, and SHALL exit normally. The system SHALL treat this interface as the contract and SHALL NOT depend on how the script delivers.

A send SHALL be reported as successful only when the script both ran to completion and printed `1`. The exit code SHALL NOT be the verdict: an exit code of 1 is what a crashing script produces, so treating it as success would report every crash of a real implementation as a delivered message.

The script MAY print diagnostics before its verdict; only the last non-empty line is read.

The script shipped with the system SHALL be a stand-in that performs no delivery, states in the file that the target environment replaces it, and exercises both outcomes. Its outcome SHALL be forceable so that automated verification can assert the success and failure paths rather than depend on chance.

The runtime image SHALL contain the interpreter the script needs, so that the feature behaves the same in development and in the delivered image.

#### Scenario: A successful send

- **WHEN** the script prints `1` as its last line and exits normally
- **THEN** the system reports the report as sent

#### Scenario: The script says it failed

- **WHEN** the script prints `0`
- **THEN** the system reports the send as failed

#### Scenario: The script crashes

- **WHEN** the script raises, cannot be found, or is killed — printing no verdict
- **THEN** the send is reported as failed, whatever exit code the failure produced

#### Scenario: Diagnostics before the verdict

- **WHEN** the script prints log lines and then its verdict
- **THEN** the verdict is read from the last non-empty line and the logs are ignored

#### Scenario: An unreadable verdict

- **WHEN** the script's last line is neither `1` nor `0`
- **THEN** the send is reported as failed rather than guessed

#### Scenario: The script is replaced

- **WHEN** the target environment overwrites the script with a real implementation honouring the same flags and the same `1`/`0` convention
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

### Requirement: A sent report is titled by its own first line

The subject of a sent report SHALL be taken from the report itself: its first non-empty line, with markdown heading and emphasis markers removed and its length capped to what a subject line can carry. Reports already open with the heading that names them, and a subject assembled from a rule name and a date makes every message in an inbox look alike.

When that line yields nothing usable, the subject SHALL fall back to a name for the report — the rule's name, or a default for an answer — so that a report is never sent with an empty subject.

The derivation SHALL be defined once, so that an answer sent from the questions page and a rule report sent on a schedule cannot title themselves by different rules.

#### Scenario: A report that opens with a heading

- **WHEN** a report whose first line is `# אנשים במרכז המחקר` is sent
- **THEN** its subject is "אנשים במרכז המחקר", without the heading marker

#### Scenario: A report that opens with prose

- **WHEN** the first line is ordinary text rather than a heading
- **THEN** that text is the subject, cleaned of emphasis markers

#### Scenario: Nothing usable at the top

- **WHEN** the report is empty, or its first line leaves nothing after the markers are stripped
- **THEN** the subject falls back to the report's name, and is never empty

#### Scenario: A very long first line

- **WHEN** the first line is longer than a subject can reasonably carry
- **THEN** it is shortened rather than sent whole
