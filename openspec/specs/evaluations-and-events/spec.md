# evaluations-and-events

## Purpose

דף חוות דעת ואירועים per-איש: סלוטים מובנים מאירועים מחזוריים + רשומות חופשיות, טקסט וקבצים.

## Requirements

### Requirement: Evaluations & events page per person

Each person SHALL have an evaluations & events page (חוות דעת ואירועים) — distinct from their personal details — that holds entries composed of textual content and/or file attachments.

#### Scenario: Adding a text entry

- **WHEN** a manager writes a textual note on a person's evaluations & events page
- **THEN** the system SHALL store it as a dated entry on that page

#### Scenario: Adding a file attachment

- **WHEN** a manager attaches a file (e.g. a signed evaluation document) to an entry
- **THEN** the system SHALL store and later retrieve the file with the entry

### Requirement: Structured entries from recurring plan events

The system SHALL create a structured slot on the evaluations & events page for each occurrence of a plan's recurring event, to be filled with content and/or a file. An occurrence whose date has passed and remains unfilled SHALL be treated as a gap (see gap-engine).

#### Scenario: Recurring occurrence creates a slot

- **WHEN** a person's plan has a recurring evaluation and an occurrence falls due at +6mo
- **THEN** the system SHALL present a structured slot for the +6mo evaluation awaiting content

#### Scenario: Filling a structured slot

- **WHEN** a manager fills the +6mo evaluation slot with a document
- **THEN** the occurrence SHALL be considered satisfied and no longer a gap

### Requirement: Free-form entries

The system SHALL allow free-form entries added ad-hoc at any time, independent of the plan (e.g. "attended conference X").

#### Scenario: Adding an ad-hoc entry

- **WHEN** a manager adds a free-form entry unrelated to any plan event
- **THEN** the system SHALL store it alongside structured entries on the same page
