## MODIFIED Requirements

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

## ADDED Requirements

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
