## ADDED Requirements

### Requirement: Drag-and-drop upload everywhere

Every surface that accepts a file SHALL support dropping a file onto it, in addition to click-to-browse: profile photos, evaluation attachments, document analysis on a person, document-based person creation, the system logo, and backup import. The selected file's name SHALL be shown before submitting.

#### Scenario: Dropping a file

- **WHEN** a user drags a file onto an upload area
- **THEN** the file is selected for that form and its name is displayed

#### Scenario: Browsing still works

- **WHEN** a user clicks the upload area instead of dragging
- **THEN** the normal file picker opens

### Requirement: Documents are converted to text before the agent reads them

Uploaded documents SHALL be converted to plain text on the server — PDF, Word, Excel, and text/CSV — and the agent SHALL be given that text rather than the raw binary. This applies both to document analysis of a person's card and to attachments included in the agent's data snapshot.

#### Scenario: Analyzing a PDF

- **WHEN** a manager uploads a text-bearing PDF and runs document analysis
- **THEN** the system extracts its text server-side and the agent proposes field values from that text

#### Scenario: Asking about a spreadsheet attachment

- **WHEN** a user asks a question about an Excel file attached to a person's evaluations
- **THEN** the agent answers from the extracted text without requesting permission to run any script

#### Scenario: Model without image support

- **WHEN** the configured model cannot interpret images or binary documents
- **THEN** document reading still succeeds, because the agent only ever receives extracted text

### Requirement: OCR fallback for scans and images

When native text extraction yields no meaningful text — a scanned PDF, or an image attachment — the system SHALL fall back to optical character recognition supporting Hebrew and English, and use the recognized text.

#### Scenario: Scanned document

- **WHEN** the uploaded PDF contains page images rather than text
- **THEN** the system runs OCR and the agent works from the recognized text

#### Scenario: Nothing readable

- **WHEN** neither extraction nor OCR produces usable text
- **THEN** the system reports that the document could not be read, instead of failing obscurely

### Requirement: Extraction requires no agent scripting permissions

Text extraction SHALL happen outside the agent, keeping the agent's toolset read-only; the agent SHALL NOT be granted script or shell execution in order to read documents.

#### Scenario: Read-only boundary preserved

- **WHEN** any document-reading feature runs
- **THEN** the agent operates with read-only tools and performs no code execution
