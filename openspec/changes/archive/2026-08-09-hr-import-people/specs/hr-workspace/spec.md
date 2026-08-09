## ADDED Requirements

### Requirement: A dedicated HR page, for the HR role and the Admin

The system SHALL provide an HR workspace page visible to users of the HR role and to the Admin, whose authority extends to everything. A Manager SHALL NOT see it in navigation, and reaching it directly SHALL be refused. The page SHALL be built to house the HR workflows, of which this change delivers the first: importing a people table.

#### Scenario: An HR user sees the page

- **WHEN** an HR user with grants signs in
- **THEN** the HR page appears in their navigation and opens for them

#### Scenario: The Admin sees it too

- **WHEN** the Admin opens the HR page
- **THEN** it opens with the full import flow, their scope being the whole tree

#### Scenario: A Manager does not

- **WHEN** a Manager opens the HR page's address
- **THEN** they are refused, and the page is absent from their navigation

### Requirement: Importing a people table

The HR page SHALL accept one CSV or Excel file whose rows are people. The system SHALL resolve each row against the registry by identity value — תעודת זהות first, then מספר אישי — and classify it:

- matched inside the HR user's edit scope → skipped;
- matched outside their edit scope → a row error naming the fact, never revealing more than that the person exists elsewhere;
- matched by the two keys to two different people → a row error;
- unmatched → a candidate for creation.

A candidate whose full name equals an existing person's inside the edit scope SHALL be halted as a possible duplicate rather than created or silently skipped — the guard for people whose identity values are not yet recorded.

Row values SHALL be taken from the file as they are, and no value SHALL ever be invented. A REQUIRED value that cannot be read blocks its row; an OPTIONAL value that cannot be read — an unreadable optional date, a choice-field value outside its options — SHALL be dropped with a warning shown on the row, and the person taken in with the rest of their details.

#### Scenario: A mixed file

- **WHEN** a file holds a person already in scope, a person known elsewhere, and a new person
- **THEN** the preview classifies them skip / error / create respectively, each with its reason

#### Scenario: Conflicting keys

- **WHEN** a row's תעודת זהות matches one person and its מספר אישי another
- **THEN** the row is an error naming the conflict, and nothing is created

#### Scenario: The possible-duplicate guard

- **WHEN** an unmatched row bears the same full name as a person in scope who has no identity value recorded
- **THEN** the row is halted as a possible duplicate, not created and not silently dropped

#### Scenario: An optional fault warns instead of blocking

- **WHEN** a new person's row carries a choice-field value outside the field's options, or an unreadable optional date
- **THEN** the faulty value is dropped, the row still creates, and the warning appears on the row before approval

### Requirement: Structure is interpreted, values are not

Column recognition SHALL be flexible: recognised header variants map deterministically, and when headers are not recognised the agent SHALL be given the header row and a few sample rows to propose a column mapping — instead of an immediate error. The proposed mapping SHALL be shown with the preview and SHALL be correctable by hand before anything is written.

The same division extends to date FORMATS: a date column whose values the Israeli gate cannot read SHALL be offered to the agent to interpret its part-order — day-first, month-first or year-first — and the rows re-parsed deterministically under it. A value no order can explain remains a row error naming it.

The agent's role SHALL end at structure: row values are processed deterministically through the mapping and the interpreted format, and the agent SHALL NOT supply, guess or repair any value.

#### Scenario: Recognised headers skip the agent

- **WHEN** the file's headers are recognisable variants of known fields
- **THEN** the mapping is derived without the agent and shown in the preview

#### Scenario: Foreign headers get an interpretation, not an error

- **WHEN** the headers match nothing known
- **THEN** the agent proposes a mapping from the headers and sample rows, and the preview shows it for correction

#### Scenario: A foreign date format is interpreted, not erred

- **WHEN** a date column is written month-first
- **THEN** the agent interprets the column's order once, the values parse under it, and an impossible value like 31/02 stays a row error

#### Scenario: The interpretation is correctable

- **WHEN** the HR user changes a proposed column mapping in the preview
- **THEN** the classification is recomputed under the corrected mapping before anything is approved

### Requirement: The row's framework is resolved within the importer's scope

The system SHALL try to identify each new person's framework from the row, resolving the name only within the HR user's edit scope. A framework that is empty, unknown or ambiguous SHALL NOT block the person: the row creates WITHOUT a framework, the reason shown as a warning before approval. Creation into a RESOLVED team SHALL require establishment authority over it, exactly as manual intake does; that refusal remains a hard error — softening it into an unassigned create would be a bypass of the establishment rule.

#### Scenario: The framework is named in the file

- **WHEN** a row names a team that exists once within the importer's scope
- **THEN** the candidate is created into that team, given establishment authority over it

#### Scenario: An unknown framework does not block the person

- **WHEN** a row names a framework that does not exist in scope, or names none
- **THEN** the person is created without a framework, and the row carries the warning saying so

#### Scenario: A repeated name warns and creates unassigned

- **WHEN** two teams in the importer's scope share the row's framework name
- **THEN** the person is created without a framework, the warning naming both candidates

#### Scenario: No establishment authority

- **WHEN** the importer's grant over the resolved team is below section level
- **THEN** the row is an error naming the missing authority, as manual intake would refuse

### Requirement: One preview, one approval, background execution

Nothing SHALL be written before approval. The upload SHALL produce a preview — every row classified with its reason, and the counts of creates, skips and errors — approved as a whole with a single act, not row by row. Execution SHALL run in the background with a visible row counter, and SHALL re-verify each creation against the live registry at write time: a person matched since the preview is skipped and reported, never duplicated because the preview had gone stale.

The run SHALL end in a report of what was created, skipped and refused, kept until dismissed.

#### Scenario: Approval is singular

- **WHEN** the HR user approves a preview of forty creates
- **THEN** all forty run in the background without further questions, and a counter shows progress

#### Scenario: The preview went stale

- **WHEN** a person in the preview's create list was meanwhile created by someone else with the same identity value
- **THEN** execution skips them and the report says so; no duplicate is created

#### Scenario: Nothing happens without approval

- **WHEN** the HR user uploads a file and walks away
- **THEN** the registry is unchanged
