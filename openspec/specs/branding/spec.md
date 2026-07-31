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
