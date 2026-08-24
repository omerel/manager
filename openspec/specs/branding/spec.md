# branding

## Purpose

מיתוג: לוגו מובנה כברירת-מחדל (סימן ״צמיחה״), החלפה/החזרה ע"י אדמין, והצגה בסרגל ובמסך ההתחברות.

## Requirements

### Requirement: Default logomark

The system SHALL ship with a built-in default logomark (a minimal growth-motif mark) displayed alongside the system name in the navigation bar and on the login page.

#### Scenario: Fresh system shows the default logo

- **WHEN** no custom logo has been configured
- **THEN** the nav bar and login page display the built-in logomark

### Requirement: Admin-replaceable logo

The Admin SHALL be able to upload a custom logo image from a system-settings page, replacing the default everywhere the logo appears, and SHALL be able to revert to the default. A replacement SHALL take effect immediately for every user, including through caching intermediaries, and SHALL NOT leave the previous custom logo in storage.

#### Scenario: Admin uploads a logo

- **WHEN** the Admin uploads an image as the system logo
- **THEN** the nav bar and login page display the uploaded logo for all users

#### Scenario: Replacing an existing custom logo

- **WHEN** the Admin uploads a new logo over an existing custom one
- **THEN** every user sees the new logo on their next page view, with no stale copy served from a browser or proxy cache

#### Scenario: Reverting to the default

- **WHEN** the Admin reverts to the built-in logomark
- **THEN** the built-in mark is displayed again immediately, and the removed custom logo is not retained in storage

### Requirement: Admin-editable system name

The system SHALL display a configurable system name wherever the product title appears — navigation bar, login page, browser-tab title, and exported report footers. The Admin edits it from the branding settings; the default is "Manager", and clearing the custom value reverts to the default.

#### Scenario: Renaming the system

- **WHEN** the Admin sets the system name to a custom value
- **THEN** the nav, login page, tab title, and report footers show the new name for all users

#### Scenario: Default and revert

- **WHEN** no custom name is set (or the Admin clears it)
- **THEN** the system displays "Manager"

#### Scenario: Admin-only

- **WHEN** a Manager attempts to change the system name
- **THEN** the system SHALL deny it

### Requirement: The Admin configures the login-page environment link

The system-settings page SHALL carry a «קישור באתר ההתחברות» block where the Admin edits the link's text (defaulting to «לאתר הפיתוח» when cleared), its URL, and its visibility (הצג / הסתר), saved together by one action. The URL SHALL be accepted only as an absolute http/https address; anything else is rejected with a Hebrew error. Saving SHALL be Admin-only and SHALL write an activity-log entry.

#### Scenario: Clearing the text restores the default

- **WHEN** the Admin saves the block with an empty text field
- **THEN** the login card shows «לאתר הפיתוח»

#### Scenario: A non-http URL is refused

- **WHEN** the Admin submits `javascript:alert(1)` as the URL
- **THEN** the save is rejected and no setting changes

### Requirement: A development-only data wipe by category

In a development build — or in any build where the runtime environment sets `ENABLE_DATA_WIPE="1"` — the system-settings page SHALL offer a «מחיקת נתונים (סביבת פיתוח)» section with five category checkboxes — אנשים, קריירה, שאלות, חוקים, שאילתות — a delete button active only when at least one is ticked, a warning-confirmation step naming the ticked categories, and on completion a success notice with the count deleted per category. The wipe SHALL run in one transaction, follow the schema's cascades, and write an activity-log entry naming the categories.

Users, access grants, the org tree, settings, field definitions, import mappings and the activity log SHALL never be touched by this tool. In a production build without the env gate the section SHALL not render and the action SHALL refuse, regardless of role; with the gate set, the tool behaves exactly as in development, admin-only confirmation ceremony included.

#### Scenario: Nothing happens without confirmation

- **WHEN** the Admin ticks אנשים and clicks the delete button
- **THEN** a warning naming אנשים appears and no data changes until אישור מחיקה is clicked

#### Scenario: The wipe reports its counts

- **WHEN** the Admin confirms a wipe of אנשים and שאילתות
- **THEN** people (with their drafts, movements and plan copies) and queries are deleted, users and the org tree remain, and the notice reports the counts per category

#### Scenario: Production refuses

- **WHEN** the action is invoked on a production build whose environment does not set `ENABLE_DATA_WIPE="1"`
- **THEN** it refuses and deletes nothing, and the section is absent from the page

#### Scenario: Careers alone keep the people

- **WHEN** the Admin confirms a wipe of קריירה only
- **THEN** all plans, their items and assignments are gone, and every person remains, unassigned

#### Scenario: The env gate opens a production deployment

- **WHEN** a production deployment runs with `ENABLE_DATA_WIPE="1"` in its environment
- **THEN** the Admin sees the wipe section and may use it with the full confirmation ceremony, while a deployment without the variable still refuses both the section and the action
