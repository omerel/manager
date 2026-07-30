# career-plans

## Purpose

תבניות תכנית קריירה יחסיות-לגיוס בעריכת אדמין: אירועים נקודתיים, מדדים מצטברים ואירועים כרוניים; העתקה ועריכה.

## Requirements

### Requirement: Career plan as a relative-to-recruitment template

A career plan SHALL be a reusable template whose timeline is defined at month granularity **relative to a person's recruitment date** (offsets such as +1mo, +9mo, +12mo), so that one template can serve many people regardless of their recruitment date. Only the Admin (מנהלן) SHALL author or edit plan templates.

#### Scenario: Authoring a plan with month offsets

- **WHEN** the Admin adds an event to a plan at offset +12 months
- **THEN** the plan stores the event as a relative offset, not an absolute calendar date

#### Scenario: Managers cannot author templates

- **WHEN** a Manager attempts to create or edit a plan template
- **THEN** the system SHALL deny the action, as template authoring is Admin-only

#### Scenario: Editing a plan dynamically

- **WHEN** a manager changes an event's offset or details on a plan
- **THEN** the system SHALL persist the edit without requiring the plan to be recreated

### Requirement: Copying a plan

The system SHALL allow the Admin to copy an existing plan to produce a new, independent plan that can be edited without affecting the original.

#### Scenario: Copy produces an independent plan

- **WHEN** a manager copies plan A to create plan B and then edits plan B
- **THEN** plan A remains unchanged

### Requirement: Point event

A career plan SHALL support **point events** (אירוע נקודתי): one-time, binary items placed at a month offset (e.g. finish basic training, transition to second/third role).

#### Scenario: Defining a point event

- **WHEN** a manager adds a point event "transition to second role" at +4 months
- **THEN** the event is tracked as binary (done / not done) against the person's recruitment-anchored date

### Requirement: Cumulative metric

A career plan SHALL support **cumulative metrics** (אירוע מצטבר): a named, unit-bearing measure that accumulates over time and carries one or more timed interim targets (e.g. training-grant hours reaching 100 by +6mo, 300 by +12mo; grant money reaching ₪1000 by +9mo).

#### Scenario: Defining a metric with interim targets

- **WHEN** a manager defines a metric "grant hours" with targets 100@+6mo and 300@+12mo
- **THEN** the plan represents a stepped planned curve against which the person's actual accumulated value can be compared

#### Scenario: Comparing planned vs actual

- **WHEN** a person has accumulated 247 of a 300-hour target due at +12mo
- **THEN** the system SHALL be able to report the actual value against the planned target at that offset

### Requirement: Recurring event

A career plan SHALL support **recurring events** (אירוע כרוני): an event defined once with a fixed interval that auto-unrolls into occurrences along the timeline (e.g. an evaluation every 6 months), stopping either at a specified date or at the person's end of service.

#### Scenario: Unrolling occurrences

- **WHEN** a manager defines a recurring evaluation every 6 months with no fixed end
- **THEN** the system SHALL generate occurrences at +6mo, +12mo, +18mo, … up to the person's end-of-service

#### Scenario: Bounded recurrence

- **WHEN** a recurring event is defined to stop at a specific date
- **THEN** the system SHALL not generate occurrences beyond that date

### Requirement: Visual career-path diagram with PDF export

The plan detail page SHALL present the plan as a schematic career-path diagram: a large upward arrow from recruitment (base) toward end of service (tip), with events placed proportionally to their month offsets — point events and metric checkpoints as labeled, iconed cards alternating sides of the arrow, and recurring events as cadence markers with a legend. The user SHALL be able to export the diagram as a PDF suitable for presentations.

#### Scenario: Viewing the diagram

- **WHEN** a user opens a plan's detail page
- **THEN** the timeline section renders the upward-arrow diagram with all plan events positioned by their offsets

#### Scenario: Exporting to PDF

- **WHEN** the user clicks the PDF export button
- **THEN** a PDF of the same diagram downloads, rendered locally (no external services)

#### Scenario: Air-gap safety

- **WHEN** the system runs in the air-gapped image
- **THEN** the diagram and its PDF export work with no network access and no packages beyond those already baked
