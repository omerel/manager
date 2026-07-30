# deployment

## Purpose

פריסה ברשת סגורה: דימוי עצמאי (ubuntu 24.04) ללא רשת בזמן-ריצה, אתחול-DB עצמי, אדמין-bootstrap מ-env, חבילת משלוח מפוצלת, healthz, תאימות OpenShift, והאזנה על 0.0.0.0.

## Requirements

### Requirement: Self-contained image with no runtime network fetches

The system SHALL ship as a single Docker image (Ubuntu 24.04 base) containing every runtime dependency — Node, the built app, Prisma CLI and engines, Chromium with Hebrew-capable fonts, and the Claude CLI — such that a container never needs to download anything at run time.

#### Scenario: Running without internet

- **WHEN** the image runs in a network with no internet access (only the database and the internal LLM endpoint reachable)
- **THEN** all features work: pages, migrations, PDF export, and agent runs via the baked-in Claude CLI

### Requirement: Environment-only runtime configuration

All runtime configuration SHALL come from environment variables: `DATABASE_URL`, `APP_SECRET`, bootstrap-admin credentials, and any Claude CLI environment (passed through to agent subprocesses unchanged). No configuration files need editing inside the container.

#### Scenario: Pointing at the managed database

- **WHEN** the container starts with `DATABASE_URL` set to the managed Postgres
- **THEN** the app uses that database exclusively

#### Scenario: Agent env passthrough

- **WHEN** the container is started with the environment the Claude CLI needs in the air-gapped network
- **THEN** agent runs inherit that environment and function without further setup

### Requirement: Self-initializing database on first boot

On start, the container SHALL wait for the database to accept connections and then apply all pending schema migrations (`migrate deploy`): a fresh empty database receives the complete schema, an existing database receives only new migrations, and an up-to-date database is untouched. First initialization and version upgrades are the same path.

#### Scenario: First boot against an empty database

- **WHEN** the container starts against a brand-new empty Postgres
- **THEN** the full schema is created and the app comes up ready

#### Scenario: Upgrade boot

- **WHEN** a newer image starts against a database from a previous version
- **THEN** only the new migrations run and existing data is preserved

### Requirement: Idempotent bootstrap admin from environment

When the users table is empty at start, the container SHALL create the first Admin from `ADMIN_USERNAME`/`ADMIN_PASSWORD` (and email) environment variables, enabling first login into an otherwise empty system. Once any user exists, bootstrap SHALL be skipped — restarts never create duplicates or overwrite existing users.

#### Scenario: Fresh system gets its admin

- **WHEN** the container first boots with bootstrap env set and no users exist
- **THEN** an Admin user is created and can log in with those credentials

#### Scenario: Restart after bootstrap

- **WHEN** the container restarts and users already exist
- **THEN** no user is created or modified

### Requirement: Offline delivery package

The build SHALL produce a self-contained delivery folder (`dist/`) for physically carrying into the air-gapped network: the image gzipped and split into 100MB parts, a loader script that joins and loads it into Docker, a runtime env template, a run example, and a Hebrew install guide.

#### Scenario: Building the package

- **WHEN** the operator runs the packaging script on a connected machine
- **THEN** `dist/` contains the split image parts, loader, env template, compose example, and guide

#### Scenario: Loading on the target

- **WHEN** the loader script runs on the air-gapped Docker host
- **THEN** the parts are joined and the image is loaded, ready to run

### Requirement: Reachable from remote machines

The served application SHALL listen on all interfaces (0.0.0.0) inside the container so the mapped port is reachable from other machines on the network.

#### Scenario: Remote browser access

- **WHEN** a user on another machine opens the host's mapped port
- **THEN** the application responds

### Requirement: Health endpoint for orchestration

The system SHALL expose a public, unauthenticated `/healthz` endpoint returning 200 when the app is up and able to reach the database, suitable for OpenShift liveness/readiness probes.

#### Scenario: Healthy pod

- **WHEN** the orchestrator probes `/healthz` and the app and database are reachable
- **THEN** the endpoint returns 200 without requiring authentication

#### Scenario: Database unreachable

- **WHEN** the database cannot be reached
- **THEN** `/healthz` returns a non-200 status so the pod is marked not-ready

### Requirement: Runs under an arbitrary non-root UID (OpenShift)

The image SHALL run correctly under OpenShift's restricted SCC — an arbitrary, non-root UID with group 0: all writable paths (uploads volume, temp/agent workspaces, the CLI's home/config) are group-0 writable, and nothing assumes a fixed user id.

#### Scenario: Pod with random UID

- **WHEN** the container starts as an arbitrary UID (group 0)
- **THEN** the app serves, uploads succeed, PDF export works, and agent runs can write their temp workspaces

### Requirement: Served pages reference no external origins

Every served page SHALL reference only same-origin assets (scripts, styles, fonts, images) — zero external URLs — verified as part of the build's checks so a future CDN reference is caught before shipping.

#### Scenario: Asset audit

- **WHEN** the verification audit scans served HTML
- **THEN** it finds no references to external origins

### Requirement: Uploads persistence

Uploaded content (attachments, photos, logo) SHALL live under a declared volume path so files survive container replacement and image upgrades.

#### Scenario: Replacing the container

- **WHEN** the container is removed and a new one starts with the same uploads volume and database
- **THEN** all previously uploaded files are still served
