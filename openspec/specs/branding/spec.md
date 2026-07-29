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

The Admin SHALL be able to upload a custom logo image from a system-settings page, replacing the default everywhere the logo appears, and SHALL be able to revert to the default.

#### Scenario: Admin uploads a logo

- **WHEN** the Admin uploads an image as the system logo
- **THEN** the nav bar and login page display the uploaded logo for all users

#### Scenario: Revert to default

- **WHEN** the Admin removes the custom logo
- **THEN** the built-in logomark is displayed again

#### Scenario: Only the Admin manages branding

- **WHEN** a Manager attempts to access the branding settings
- **THEN** the system SHALL deny it
