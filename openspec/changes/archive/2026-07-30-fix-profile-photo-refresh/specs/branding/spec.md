## MODIFIED Requirements

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
