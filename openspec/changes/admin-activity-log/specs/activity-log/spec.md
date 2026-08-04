## ADDED Requirements

### Requirement: User activity is recorded for the Admin to investigate

The system SHALL record the meaningful acts users perform, so that the Admin can find out who changed something and when. A recorded act SHALL include who performed it, what was done, which record it concerned, and the time.

The recorded acts SHALL be those that change the registry or who may reach it: creating, editing and deleting people, plan templates and their items, plan assignments, frameworks, users and access grants, evaluations and rules, and importing a configuration or backup. Reads SHALL NOT be recorded.

Recording SHALL be a light trail, not a second copy of the data: an entry SHALL NOT store the previous or new values of what changed.

#### Scenario: Someone deletes a person

- **WHEN** a user deletes a person
- **THEN** the log holds an entry naming that user, the act, and the person concerned, timed

#### Scenario: Someone is granted access

- **WHEN** an Admin grants a user access to a framework
- **THEN** the act is recorded

#### Scenario: Reading changes nothing

- **WHEN** a user opens pages and reads records
- **THEN** nothing is written to the log

#### Scenario: The log is not a backup

- **WHEN** a person's date is edited
- **THEN** the entry records that it was edited and by whom, without storing the old or new date

### Requirement: An entry reads as a sentence, and stays true

Each entry SHALL carry a description composed at the moment of the act, in the language of the interface, understandable without knowledge of the database. The description and the actor's name SHALL be stored as written and SHALL NOT be re-derived from live records when the log is read.

An entry SHALL remain readable after its subject is gone or renamed — the deleted and renamed cases being exactly what an investigation looks into.

#### Scenario: The subject was deleted afterwards

- **WHEN** the Admin reads an entry about a person who has since been deleted
- **THEN** the entry still names that person as it did when it was written

#### Scenario: The actor was renamed afterwards

- **WHEN** a user's name changes after they acted
- **THEN** entries about their earlier acts still show the name recorded at the time

### Requirement: Only the Admin may read the log

The activity log SHALL be reachable by the Admin only. The restriction SHALL be enforced where the data is read, not only by hiding the page, so a request that bypasses the interface is refused.

#### Scenario: A manager tries to reach it

- **WHEN** a user who is not the Admin requests the activity log
- **THEN** they are refused, and no entries are returned

#### Scenario: The Admin investigates

- **WHEN** the Admin opens the log
- **THEN** entries are shown newest first, and can be narrowed by the user who acted and by the kind of act

### Requirement: Recording never disturbs what it observes

A failure to record SHALL NOT fail, delay or alter the act being recorded. An entry SHALL be written only after the act it describes has succeeded, so the log never claims something that did not happen.

#### Scenario: Recording fails

- **WHEN** an entry cannot be written
- **THEN** the user's action still succeeds and is reported as successful

#### Scenario: The action fails

- **WHEN** an action fails partway
- **THEN** no entry is written for it

### Requirement: Entries are kept for a bounded period

Entries SHALL be kept for a configurable number of days, one month by default, after which they are removed. The retention period SHALL be settable per environment without changing code, and a setting of zero SHALL keep entries indefinitely.

Removal SHALL NOT require a scheduler, and the retention period is a bound on what is kept rather than a guarantee that an entry disappears the instant it lapses.

#### Scenario: An old entry

- **WHEN** entries are older than the configured window and activity continues
- **THEN** those entries are removed

#### Scenario: A different environment

- **WHEN** an environment sets a longer retention
- **THEN** entries are kept for that period, with no code change

#### Scenario: Keeping everything

- **WHEN** retention is set to zero
- **THEN** no entry is removed by age
