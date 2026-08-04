## ADDED Requirements

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

## MODIFIED Requirements

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
