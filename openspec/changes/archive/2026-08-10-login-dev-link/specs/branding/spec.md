## ADDED Requirements

### Requirement: The Admin configures the login-page environment link

The system-settings page SHALL carry a «קישור באתר ההתחברות» block where the Admin edits the link's text (defaulting to «לאתר הפיתוח» when cleared), its URL, and its visibility (הצג / הסתר), saved together by one action. The URL SHALL be accepted only as an absolute http/https address; anything else is rejected with a Hebrew error. Saving SHALL be Admin-only and SHALL write an activity-log entry.

#### Scenario: Clearing the text restores the default

- **WHEN** the Admin saves the block with an empty text field
- **THEN** the login card shows «לאתר הפיתוח»

#### Scenario: A non-http URL is refused

- **WHEN** the Admin submits `javascript:alert(1)` as the URL
- **THEN** the save is rejected and no setting changes
