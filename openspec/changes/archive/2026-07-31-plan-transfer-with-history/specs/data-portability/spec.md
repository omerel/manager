## MODIFIED Requirements

### Requirement: Full export bundle

The Admin SHALL be able to download a full backup bundle containing all business data — org tree, person-card schema, plan templates, people (field values, progress, evaluations), **plan assignments including ended ones, with their waivers and carry-over records**, users with grants and password hashes, rules including pinned realizations, and app settings — together with the referenced upload files (attachments, photos, logo). Transient records (agent runs, drafts, extraction proposals) are excluded. The bundle SHALL carry a version, scope, and export timestamp.

#### Scenario: Downloading a full backup

- **WHEN** the Admin triggers a full export
- **THEN** a single archive downloads containing the versioned data file and the referenced upload files

#### Scenario: Export is admin-only

- **WHEN** a Manager attempts to use the export/import endpoints
- **THEN** the system SHALL deny access

#### Scenario: Plan history survives a round trip

- **WHEN** a full backup of a system containing transferred people is exported and restored
- **THEN** every person's ended assignments, their waivers and their carry-over records are present exactly as before
