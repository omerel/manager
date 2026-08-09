## ADDED Requirements

### Requirement: Every workforce movement is recorded as a snapshot

The system SHALL record every workforce movement — a person created (manually, by intake, or by bulk import), moved between frameworks, deleted, or transitioned into עזב status — as a snapshot row carrying the movement kind, the person's name, the source and destination frameworks by id and by path as they read at that moment, the acting user, the channel, and the time. The row SHALL survive the deletion of the person and of the frameworks it names.

Deleting a framework SHALL emit a movement for every person it orphans — moved to ללא שיוך, attributed to the deleting Admin — so the one movement that today happens at the database level gains witnesses. A status edit SHALL emit only on a transition INTO עזב, and restoring from a backup SHALL emit nothing: data recovery is not a workforce movement.

#### Scenario: A bulk import emits per person

- **WHEN** an import run creates twelve people
- **THEN** twelve CREATED movements are recorded, each naming its person, team and the importing user

#### Scenario: Orphaning gains witnesses

- **WHEN** the Admin deletes a section whose teams held five people
- **THEN** five movements record each person moving to ללא שיוך, attributed to that Admin

#### Scenario: Departure is a transition

- **WHEN** a person's status is set to עזב, and later their card is edited again without changing status
- **THEN** exactly one DEPARTED movement exists

#### Scenario: The record outlives its subjects

- **WHEN** a person and their old framework are both later deleted
- **THEN** the movement rows still read with the names and paths of the time

### Requirement: The movement log is daily, filtered, and scoped

The HR page SHALL carry a third part — עדכוני כוח אדם — showing movements one day at a time with date navigation, filterable by kind, framework and actor, each row linking to the person's card where the person still exists and showing the name unlinked where not.

An HR user SHALL see a movement when its source or its destination lies within their edit scope — a move OUT of their scope remains visible to them — and the Admin sees everything. Retention SHALL be configurable by environment variable, separate from the activity log's.

#### Scenario: A move out of scope is visible

- **WHEN** a commander moves a person from the HR user's scope to a framework outside it
- **THEN** the HR user's log shows the movement, with both paths

#### Scenario: The daily cut

- **WHEN** the HR user navigates to yesterday
- **THEN** only yesterday's movements show, under the active filters

#### Scenario: A deleted person is shown, unlinked

- **WHEN** a movement's person no longer exists
- **THEN** the row shows their name as plain text with no link
