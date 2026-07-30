## MODIFIED Requirements

### Requirement: Uploads persistence

Uploaded content (attachments, photos, logo) SHALL be stored under a path given by environment configuration, so operators can mount a persistent volume there. Files SHALL survive container replacement, pod restarts, and image upgrades when that path is backed by persistent storage, and the deployment documentation SHALL state this requirement explicitly.

#### Scenario: Replacing the container

- **WHEN** the container is removed and a new one starts with the same uploads storage and database
- **THEN** all previously uploaded files are still served

#### Scenario: Configuring the location

- **WHEN** an operator sets the uploads path environment variable
- **THEN** the application reads and writes all uploaded files under that path

#### Scenario: Pod restart in orchestration

- **WHEN** a pod is replaced and the uploads path is backed by a persistent volume claim
- **THEN** previously uploaded photos and attachments are still displayed rather than appearing missing
