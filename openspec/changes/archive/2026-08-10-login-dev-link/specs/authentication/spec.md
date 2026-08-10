## ADDED Requirements

### Requirement: The login page offers the configured environment link

The login page SHALL show, beneath the login form, a card with the configured text and a link-button to the configured URL, opening in a new tab — but only when the link is both enabled and has a URL. When disabled, or when no URL is set, nothing SHALL render. A fresh install defaults to hidden.

#### Scenario: Enabled and configured

- **WHEN** the Admin has set a URL and chosen הצג
- **THEN** a signed-out visitor sees the card and the button leads to that URL in a new tab

#### Scenario: Enabled but empty

- **WHEN** the link is set to הצג but the URL was cleared
- **THEN** the login page shows no card

#### Scenario: Hidden

- **WHEN** the Admin chose הסתר
- **THEN** the login page shows no card regardless of the stored text and URL
