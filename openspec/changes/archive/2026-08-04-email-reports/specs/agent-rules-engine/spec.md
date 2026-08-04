## MODIFIED Requirements

### Requirement: One-time and chronic execution

A rule SHALL be runnable either one-time (on demand) or chronically on a schedule defined by the user (e.g. monthly, quarterly). Each run SHALL produce its output on a dedicated results page as a document or file.

A rule SHALL also carry a setting for whether each of its runs is emailed to its owner. That setting SHALL be available when the rule is created and editable afterwards, alongside the schedule. It SHALL apply to scheduled and on-demand runs alike, and SHALL be read at the moment a run completes, so switching it off stops the next email even for a run already under way.

#### Scenario: One-time run

- **WHEN** a user triggers a rule once
- **THEN** the agent SHALL execute it and place the resulting document/file on the results page

#### Scenario: Chronic run

- **WHEN** a rule is scheduled monthly
- **THEN** the system SHALL run it on that cadence and append each run's output to the results page

#### Scenario: A rule set to email its owner

- **WHEN** a rule with the email setting on completes a run
- **THEN** its output is emailed to the rule's owner, in addition to appearing on the results page

#### Scenario: The setting is changed later

- **WHEN** the owner turns the email setting off
- **THEN** subsequent runs are not emailed, without the rule having to be recreated

#### Scenario: Existing rules are unchanged

- **WHEN** the setting is introduced to rules that predate it
- **THEN** each is off, so no rule starts emailing without its owner asking
