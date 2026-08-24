# branding — delta

## MODIFIED Requirements

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
