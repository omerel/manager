## ADDED Requirements

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
