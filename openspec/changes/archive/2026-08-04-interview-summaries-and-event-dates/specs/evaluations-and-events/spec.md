## ADDED Requirements

### Requirement: Ad-hoc interview summaries

The system SHALL allow recording an ad-hoc interview against a person: a subject, the date it took place, an optional file, and an optional assessment. Interview summaries SHALL be listed separately from free-form entries, because a rated interview and a note about a conference answer different questions and one list would make both harder to read.

#### Scenario: Recording an interview

- **WHEN** a manager records an interview with a subject and a date
- **THEN** it is stored against that person and listed among their interview summaries, not among the free-form entries

#### Scenario: An interview with a document

- **WHEN** a file is attached to an interview summary
- **THEN** it is stored and reachable from the entry, as with any other entry

#### Scenario: Interviews stay out of the plan's slots

- **WHEN** a person has both plan-driven evaluation occurrences and ad-hoc interviews
- **THEN** the two are shown separately, and an interview never fills a plan occurrence

### Requirement: The interview assessment is a named five-point scale

An interview summary MAY carry an assessment on a five-point scale whose meanings are fixed: 1 אי הצלחה, 2 מתחת למצופה, 3 כמצופה, 4 הצלחה מלאה, 5 מעל המצופה. The scale SHALL apply to interview summaries only — a recurring evaluation occurrence answers whether the plan was met, not how well someone performed, and one scale over both would conflate compliance with quality.

The assessment SHALL be optional: an interview may be recorded without one, and an unrated interview SHALL carry no value rather than a default nobody chose.

Wherever an assessment is displayed, its meaning SHALL be displayed with it — a bare number tells a reader nothing. The five meanings SHALL be defined in one place, so that no two surfaces can disagree about what a value means.

A submitted value outside the scale SHALL be refused, not adjusted to the nearest valid one: adjusting would record an assessment of a person that nobody made.

#### Scenario: Rating an interview

- **WHEN** a manager records an interview and selects 4
- **THEN** the entry shows "הצלחה מלאה" together with the value

#### Scenario: Leaving it unrated

- **WHEN** a manager records an interview without selecting an assessment
- **THEN** the entry is stored with no assessment, and none is displayed

#### Scenario: A value outside the scale

- **WHEN** a value outside 1–5 is submitted
- **THEN** it is refused, and no entry is stored with an invented assessment

#### Scenario: Plan occurrences are not rated

- **WHEN** a manager fills a plan-driven evaluation occurrence
- **THEN** no assessment scale is offered for it

## MODIFIED Requirements

### Requirement: Free-form entries

The system SHALL allow free-form entries added ad-hoc at any time, independent of the plan (e.g. "attended conference X").

Every entry SHALL record **when the event happened**, separately from when it was recorded. The event date SHALL default to today, so recording something on the day it happened costs nothing, and entries SHALL be listed in the order the events occurred rather than the order they were typed.

Entries that predate this SHALL take their recorded date as their event date — the value the page had already been presenting as the event's date — so no entry changes meaning when the field is introduced.

#### Scenario: Adding an ad-hoc entry

- **WHEN** a manager adds a free-form entry unrelated to any plan event
- **THEN** the system SHALL store it alongside structured entries on the same page

#### Scenario: Writing up something that happened earlier

- **WHEN** a manager records an event that took place three weeks ago and sets its date accordingly
- **THEN** the entry is dated and ordered by when the event happened, not by when it was typed

#### Scenario: Recording something the same day

- **WHEN** a manager adds an entry without changing the date
- **THEN** it is dated today

#### Scenario: Existing entries when the field is introduced

- **WHEN** the event date is introduced to entries that have none
- **THEN** each takes its recorded date, and the page reads exactly as it did before
