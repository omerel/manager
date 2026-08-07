## MODIFIED Requirements

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
