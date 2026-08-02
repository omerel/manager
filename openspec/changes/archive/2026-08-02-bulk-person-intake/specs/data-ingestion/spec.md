## ADDED Requirements

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
