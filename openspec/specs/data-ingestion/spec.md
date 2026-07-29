# data-ingestion

## Purpose

קליטת נתונים ממסמכים בעזרת הסוכן: חילוץ → טיוטה → אישור אנושי (שדה-שדה או טופס מלא-מראש); ללא כתיבה אוטונומית.

## Requirements

### Requirement: Agent-assisted person creation from a PDF

When a Manager creates a person, the system SHALL allow uploading a PDF from which the agent attempts to extract the fields required by the current person-card schema, pre-filling a draft form for the Manager.

#### Scenario: Successful extraction pre-fills the form

- **WHEN** a Manager uploads a PDF and the agent matches schema fields
- **THEN** the system SHALL present a person-creation form pre-filled with the extracted values

#### Scenario: Extraction targets the configured schema

- **WHEN** the person-card schema defines the required fields
- **THEN** the agent SHALL attempt to extract exactly those fields, not a fixed hard-coded set

### Requirement: Manual fallback on failed or partial extraction

If the agent cannot extract the required fields (fully or partially), the system SHALL let the Manager enter the missing values manually.

#### Scenario: Failed extraction

- **WHEN** the agent cannot extract any usable fields from the PDF
- **THEN** the system SHALL present an empty form for manual entry

#### Scenario: Partial extraction

- **WHEN** the agent extracts only some fields
- **THEN** the system SHALL pre-fill those and leave the rest for the Manager to complete

### Requirement: The agent has no autonomous write authority

Extraction SHALL only produce a draft; the person record SHALL be persisted only when the Manager confirms and saves. The agent SHALL NOT autonomously write to source-of-truth data. This preserves the system-wide invariant that every mutation of manager-owned data is a human action.

#### Scenario: Draft is not persisted until confirmed

- **WHEN** the agent pre-fills a person-creation form from a PDF
- **THEN** no person record exists until the Manager reviews and saves it

#### Scenario: Manager edits an extracted value before saving

- **WHEN** the Manager corrects an extracted field and then saves
- **THEN** the saved value is the Manager's, and the agent's extraction was only a proposal
