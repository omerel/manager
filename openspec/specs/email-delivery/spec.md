# email-delivery

## Purpose

שליחת דוח שהמערכת הפיקה לכתובת המייל של בעליו: מה נשלח, למי, ואיך כישלון שליחה מוצג.

## Requirements

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

### Requirement: Delivery runs through a replaceable script

Sending SHALL be performed by invoking `emailer.py` with `--title`, `--body` and `--to`, and with `--from` carrying a display string of who sent it. The script SHALL report its outcome as a **boolean on standard output — `1` for sent, `0` for failed — as the last non-empty line it prints**, and SHALL exit normally. The system SHALL treat this interface as the contract and SHALL NOT depend on how the script delivers.

`--from` SHALL be optional to the script: a replacement written against the three-flag contract remains valid, and a replacement MAY ignore the flag. Inside the system, however, the sender SHALL be a required argument of the sending API, so that a call site cannot omit it silently.

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
- **THEN** only the last non-empty line decides the outcome

#### Scenario: An unreadable verdict

- **WHEN** the script's last line is neither `1` nor `0`
- **THEN** the send is reported as failed rather than guessed

#### Scenario: The script is replaced

- **WHEN** the target environment overwrites the script with a real implementation honouring the same flags and the same `1`/`0` convention
- **THEN** no change to the system is required for mail to be delivered

#### Scenario: A replacement without the sender flag

- **WHEN** the target environment's script accepts only the original three flags
- **THEN** it remains a valid replacement; the sender flag is additive and ignorable

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

### Requirement: Query mail is sent after the response, and its outcome is kept

Mail for a query — the notification on sending, any reminder, and the notification of an answer — SHALL be dispatched after the response has been returned, so that a send to many frameworks does not hold up the form.

Because the sender is no longer waiting to hear the outcome, the outcome of each send SHALL be recorded against the target framework and shown in the query's list. A failure SHALL NOT be silent merely because it happened after the page was rendered.

#### Scenario: The form returns immediately

- **WHEN** a center commander sends a query to eight domains
- **THEN** the page returns without waiting for eight messages to be sent

#### Scenario: A failure is recorded rather than lost

- **WHEN** the mail for one target framework fails after the response was returned
- **THEN** the sender sees that failure on that framework's row the next time they view the query

### Requirement: The stand-in keeps a log of every send

The stand-in script SHALL append one human-readable line to a log file for every invocation: when, who sent, to whom, the subject, and the verdict it returned. Failed sends SHALL be logged like successful ones — the stand-in fails deliberately, and a log of successes only would test half the mechanism.

The log's location SHALL be configurable by environment variable, defaulting to a file beside the script. A failure to write the log SHALL NOT fail the send: a warning is printed and the verdict proceeds — the testing aid must not become the fault it exists to catch.

Every surface that sends mail SHALL pass the sender: the rule's owner for a chronic run, the signed-in asker on the questions page, and the acting user for query notifications, reminders and answer notices.

The log is a property of the stand-in, not of the contract: a real replacement brings the real mail system's own records, and SHALL NOT be required to keep this file.

#### Scenario: A send is logged

- **WHEN** the stand-in is invoked for a rule's report
- **THEN** the log gains a line naming the time, the rule's owner as sender, the recipient, the subject, and whether it reported sent or failed

#### Scenario: A failed send is logged too

- **WHEN** the stand-in decides an invocation failed
- **THEN** the line records the failure — the log shows both outcomes of the mechanism under test

#### Scenario: A burst of sends is fully accounted for

- **WHEN** a query goes to several frameworks at once
- **THEN** the log gains one line per recipient, so the tester can count that every one went out

#### Scenario: An unwritable log does not break sending

- **WHEN** the log's directory cannot be written
- **THEN** the send proceeds to its verdict, with a warning instead of a log line
