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

### Requirement: Bulk intake of person documents

The Admin, and only the Admin, SHALL be able to submit multiple documents at once, each document representing one person. Each document SHALL be processed as an independent extraction job: jobs run concurrently under a bounded cap, and one document's failure SHALL NOT affect the processing of the others. The single-document creation flow is unchanged by the existence of bulk intake.

#### Scenario: Dropping a batch

- **WHEN** the Admin drops several personnel files at once
- **THEN** every file appears immediately in an intake queue, each processed as its own job

#### Scenario: One bad file among many

- **WHEN** one file in a batch cannot be read or extracted
- **THEN** that file is marked failed with its reason, and every other file continues to a reviewable result

#### Scenario: Not offered below Admin

- **WHEN** a non-admin user uses the people pages
- **THEN** bulk intake is not offered, and a directly submitted bulk request is refused

### Requirement: A document routes to an existing person or to a new draft

For each document, the system SHALL compare the extracted full name against existing people. If it matches **exactly one** person, the document SHALL become field-level update proposals on that person. If it matches none — or more than one — it SHALL become a new-person draft; an ambiguous name is never resolved by guessing, because a misdirected update to a person's record is worse than a duplicate draft the reviewer can discard.

#### Scenario: A file for an existing employee

- **WHEN** a document's extracted full name exactly matches one person in the registry
- **THEN** the extraction becomes pending field proposals on that person, reviewable field-by-field

#### Scenario: A file for a new employee

- **WHEN** the extracted name matches no existing person
- **THEN** the extraction becomes a prefilled new-person draft

#### Scenario: An ambiguous name

- **WHEN** the extracted name matches more than one existing person
- **THEN** the file becomes a new-person draft rather than an update to either, and the reviewer decides

### Requirement: Ready items are reviewable without waiting for the batch

The intake queue SHALL show each document's state — processing, ready, or failed — and each ready item SHALL link to its review: the prefilled form for a new person, or the person's card for pending proposals. A ready item SHALL be reviewable immediately, while other documents are still processing. Nothing from a batch SHALL be written to the registry without the Admin approving that item individually; there SHALL be no batch-level approval.

#### Scenario: Reviewing while the batch runs

- **WHEN** the first document of a batch finishes while others are still processing
- **THEN** the Admin can open and approve that item at once, without waiting for the rest

#### Scenario: Approval is per item

- **WHEN** a batch of ten documents is fully processed
- **THEN** each of the ten results requires its own review and approval, and no control applies them all at once

### Requirement: A queue row lists only work that is still outstanding

Each ready item SHALL offer both an approval route — opening its review — and a way to discard it. An item SHALL leave the queue once it no longer needs attention: when its review has been saved, and when it has been discarded. Discarding SHALL destroy what the extraction produced (the unapproved draft, or the pending field proposals) and SHALL NOT alter the registry.

A queue row SHALL be actionable only by the user whose intake produced it.

#### Scenario: Approving and saving clears the row

- **WHEN** the Admin opens a ready item, reviews the details and saves
- **THEN** the person is created or updated, and that item no longer appears in the queue

#### Scenario: Discarding clears the row

- **WHEN** the Admin discards a ready item
- **THEN** the item disappears from the queue, its draft or pending proposals are destroyed, and nothing is written to the registry

#### Scenario: Discarding one leaves the rest

- **WHEN** one item of a batch is discarded
- **THEN** every other item of that batch remains in the queue, unchanged

#### Scenario: A failed document can be cleared too

- **WHEN** a document failed to extract
- **THEN** it offers no approval, and can be dismissed from the queue

#### Scenario: Another user cannot act on the row

- **WHEN** a request to discard an item arrives from anyone other than the user whose intake produced it
- **THEN** it is refused and the item is left untouched

### Requirement: An extracted date is read as an Israeli date, or not at all

The documents this system reads are Israeli, and a numeric date in them is day-first. The agent SHALL be told so, and every date it returns SHALL be interpreted day-first regardless of how it is punctuated.

An extracted date that cannot be parsed unambiguously SHALL NOT be proposed. It SHALL be omitted from the proposal so the reviewer sees a missing field and supplies it, rather than being shown a confidently wrong date on a screen designed to be approved quickly. The system SHALL NOT fall back to a month-first reading to rescue such a value.

#### Scenario: A document written the Israeli way

- **WHEN** a document gives a date as `03/08/2026` and the agent returns it
- **THEN** the proposed value is 3 August 2026

#### Scenario: A date the system cannot read

- **WHEN** the agent returns a date in a form the parser does not accept
- **THEN** that field is absent from the proposal, and no value is written for it

#### Scenario: No rescue by the American reading

- **WHEN** an extracted numeric date would only be valid if read month-first
- **THEN** it is refused rather than reinterpreted

#### Scenario: The reviewer still decides

- **WHEN** a date is successfully extracted and proposed
- **THEN** it is applied only after the reviewer approves that field, as with every other proposed field
