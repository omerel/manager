## ADDED Requirements

### Requirement: A weekly file updates existing people, and only updates

The HR page SHALL offer an external-update part accepting one CSV or Excel file. It SHALL NOT create people: a row whose identity matches nobody is skipped silently. Updates SHALL be proposed only for people within the operator's edit scope, and nothing SHALL be written to any person except by explicit field-level approval.

#### Scenario: An unknown person is skipped in silence

- **WHEN** the weekly file holds a row for a person not in the registry
- **THEN** no proposal is created for it and the review is not cluttered by it

#### Scenario: Out-of-scope people produce nothing

- **WHEN** the file holds people outside the operator's edit scope
- **THEN** no proposals are created for them

### Requirement: One global mapping, saved on first approval

Column mapping for the update file SHALL be global — keyed by the file's header signature, shared by every HR user — and saved when first approved, so subsequent uploads of the same structure skip straight to the diff. The user MAY reopen and edit the saved mapping at will.

A column MAY map to multiple targets at once: card fields, and career values by label — a point event's completion date (`point:<label>`) or a cumulative metric's value (`metric:<label>`) — resolved per person against their own assigned plan, targets absent from it silently inapplicable. Evaluations and recurring events SHALL NOT be mapping targets.

The mapping editor SHALL be searchable per column with tick-mark multi-selection — no modifier keys — where an unticked column is simply ignored, and every offered target SHALL name its source: the person card, or the career plans that carry the label.

#### Scenario: The second upload skips the mapping

- **WHEN** a file with a known header signature is uploaded
- **THEN** the saved mapping applies without re-approval and the flow proceeds to the diff

#### Scenario: One column, several careers

- **WHEN** a column maps to point events in two different plan templates
- **THEN** each person's update uses the target their own plan carries, and people on other plans are untouched by that column

#### Scenario: A changed structure asks before remapping

- **WHEN** the uploaded file's headers differ from the saved signature
- **THEN** the user is shown what appeared and what vanished and asked to proceed; known columns keep their mapping and only the new ones are mapped afresh

### Requirement: Only what changed is proposed, and the file never overrides by silence

The update SHALL diff twice: against the previous file's snapshot — only cells that changed in the file continue — and against the system's current values — only values that differ become proposals. A hand-made correction in the system SHALL survive as long as the file did not change; the first upload, having no snapshot, SHALL compare everything against the system.

A value emptied in the file SHALL become a deletion proposal only where emptiness is legal — a configurable field, a point event's completion, a metric reading; an emptied required cell SHALL be a row warning, never a proposal.

#### Scenario: A hand correction survives an unchanged file

- **WHEN** a value was corrected by hand in the system and the file's cell is unchanged since last week
- **THEN** no proposal is created and the correction stands

#### Scenario: Only the changed cells surface

- **WHEN** three cells changed in the weekly file out of hundreds
- **THEN** the review holds proposals for those three alone, where they differ from the system

#### Scenario: An emptied optional value proposes deletion

- **WHEN** a cell mapped to a metric reading was full last week and is empty now
- **THEN** a deletion proposal appears for field-level approval, unchecked by default

#### Scenario: An emptied required cell cannot propose deletion

- **WHEN** a cell mapped to a required card field is emptied
- **THEN** the row carries a warning and no deletion is proposed

### Requirement: Review is central, approval is per field

The proposals of a run SHALL be reviewed on one screen in the HR page, grouped by person: each person expands to their changes shown as current → proposed, each approvable or rejectable on its own, with per-person and approve-all-marked shortcuts. Applying an approved field SHALL write exactly that field — card value, point completion, or metric reading — through the same application path the intake proposals use.

The imported file SHALL be saved to the history with its upload time and uploader when the review concludes, and its row snapshot becomes the base of the next diff. A run abandoned mid-review SHALL NOT become the next diff's base. The last concluded file SHALL be downloadable from the history, so the operator can inspect the format the master system last produced.

#### Scenario: Field-level approval

- **WHEN** a person's row proposes three changes and the reviewer approves two
- **THEN** exactly those two are written and the third leaves no trace on the person

#### Scenario: Career values apply to the person's own plan

- **WHEN** an approved field targets `point:הסמכה` and the person's plan has an event by that label
- **THEN** the completion is recorded with the file's date against that person's own plan copy

#### Scenario: The last file is downloadable

- **WHEN** the operator asks for the last concluded file
- **THEN** the original bytes download under their original name, for HR and Admin alone

#### Scenario: The history advances only on conclusion

- **WHEN** a review is abandoned before conclusion
- **THEN** the previous snapshot remains the diff base, and the next upload diffs against it
