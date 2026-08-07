# data-portability

## Purpose

ניידות נתונים לאדמין: גיבוי מלא (ZIP עם נתונים וקבצים), ייצוא תצורה (JSON), ושחזור מוגן ואטומי עם חבילות מגורסאות.

## Requirements

### Requirement: Full export bundle

The Admin SHALL be able to download a full backup bundle containing all business data — org tree, person-card schema, plan templates, people (field values, progress, evaluations), **plan assignments including ended ones, with their waivers and carry-over records**, **commander queries with their recipients and answers**, **the activity log**, users with grants and password hashes, rules including pinned realizations, and app settings — together with the referenced upload files (attachments, photos, logo). Transient records (agent runs, drafts, extraction proposals) are excluded. The bundle SHALL carry a version, scope, and export timestamp.

#### Scenario: Downloading a full backup

- **WHEN** the Admin triggers a full export
- **THEN** a single archive downloads containing the versioned data file and the referenced upload files

#### Scenario: Export is admin-only

- **WHEN** a Manager attempts to use the export/import endpoints
- **THEN** the system SHALL deny access

#### Scenario: Plan history survives a round trip

- **WHEN** a full backup of a system containing transferred people is exported and restored
- **THEN** every person's ended assignments, their waivers and their carry-over records are present exactly as before

#### Scenario: Queries and the activity log survive a round trip

- **WHEN** a full backup of a system containing commander queries and activity entries is exported and restored
- **THEN** every query, every recipient row with its answer, and every log entry are present exactly as before — none lost to the restore's rebuilding of the frameworks they reference

#### Scenario: An older bundle still restores

- **WHEN** a bundle exported before queries and the activity log joined the format is imported
- **THEN** the restore succeeds, with those tables simply left empty

### Requirement: Configuration-only export

The Admin SHALL be able to export a configuration-only bundle: card-field definitions, org tree, plan templates, users + grants, and app settings — without people records or files.

#### Scenario: Downloading configuration

- **WHEN** the Admin triggers a configuration export
- **THEN** a JSON bundle downloads containing only the configuration layer, marked with scope "config"

### Requirement: Guarded full restore

Importing a full bundle SHALL perform a complete restore: existing business data is replaced by the bundle's contents with original ids preserved (relations intact), and bundled files are restored. The action SHALL require an explicit confirmation acknowledging that existing data will be deleted, and SHALL be atomic for the database portion — a failed import leaves existing data unchanged.

#### Scenario: Restoring a backup

- **WHEN** the Admin uploads a full bundle and confirms the destructive-restore checkbox
- **THEN** the system replaces all business data and files with the bundle's contents and reports success

#### Scenario: Import without confirmation

- **WHEN** the Admin uploads a bundle without checking the confirmation
- **THEN** nothing is imported

#### Scenario: Failed import leaves data intact

- **WHEN** an import fails mid-way (invalid content, constraint error)
- **THEN** the database is left as it was before the import

### Requirement: Configuration import only into an empty registry

A configuration-scope bundle SHALL be importable only when the people registry is empty (fresh-system seeding); otherwise the import is rejected with a clear message.

#### Scenario: Seeding a fresh system

- **WHEN** the registry has no people and the Admin imports a configuration bundle with confirmation
- **THEN** the configuration layer is replaced by the bundle's contents

#### Scenario: Config import into a live system is rejected

- **WHEN** people exist and the Admin uploads a configuration bundle
- **THEN** the import is rejected and no data changes

### Requirement: Bundle validation

Imports SHALL validate the bundle before touching data: recognizable format, supported version, and declared scope. Invalid bundles are rejected with a clear error and no changes.

#### Scenario: Wrong file rejected

- **WHEN** the Admin uploads a file that is not a valid bundle (or an unsupported version)
- **THEN** the system rejects it with an explanatory message and imports nothing
