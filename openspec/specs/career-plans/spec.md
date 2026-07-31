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

A career plan SHALL support **recurring events** (אירוע כרוני): an event defined once with a fixed interval that auto-unrolls into occurrences along the timeline (e.g. an evaluation every 6 months). A recurring event SHALL stop at a **required month offset from recruitment**; stopping "at the person's end of service" SHALL NOT be offered as an authoring option, because that date is unknown for most people and a plan must describe the same schedule for everyone assigned to it. The system SHALL NOT substitute a default or horizon for a missing stop offset.

#### Scenario: Unrolling occurrences

- **WHEN** a manager defines a recurring evaluation every 6 months stopping at month 72
- **THEN** the system SHALL generate occurrences at +6mo, +12mo, +18mo … up to and including +72mo, and none beyond

#### Scenario: Stop offset is required

- **WHEN** a manager tries to save a recurring event without a stop month
- **THEN** the system SHALL reject it rather than choosing a stop month on the manager's behalf

#### Scenario: The plan schedules everyone identically

- **WHEN** two people are assigned the same plan
- **THEN** the recurring event unrolls to the same set of month offsets for both, independent of anything recorded on either person

### Requirement: Visual career-path diagram with PDF export

The plan detail page SHALL present the plan as a schematic career-path diagram: a large upward arrow from recruitment (base) toward end of service (tip), with **recruitment at the base and, above it, one evenly spaced tick per month in which the plan has an event** — point events and metric checkpoints as labeled, iconed cards alternating sides of the arrow, and recurring events as cadence markers with a legend carrying the recurring icon and, per event, its own colour marker matching the markers on the arrow. Each tick SHALL be labeled with its month offset, and a single break marker SHALL mark the jump from recruitment to the first event month. Recurring cadence markers SHALL be drawn only across the span occupied by the plan's point events and metric checkpoints — from the earliest to the latest — while the legend continues to state each recurring event's real definition. The diagram's height SHALL depend on how many event months are drawn, not on how far into the future the plan extends. The user SHALL be able to export the diagram as a PDF suitable for presentations.

#### Scenario: Viewing the diagram

- **WHEN** a user opens a plan's detail page
- **THEN** the timeline section renders the upward-arrow diagram with all plan events placed on the event-month ticks

#### Scenario: A long plan stays readable

- **WHEN** a plan's events run to 72 months
- **THEN** the diagram occupies the same space as a plan with the same number of drawn event months over a shorter span

#### Scenario: Recurrence is drawn within the plan's span

- **WHEN** a recurring event continues past the plan's last point event or checkpoint
- **THEN** its markers are drawn only up to that last milestone, and the legend states both the event's real stop month and the span the drawing covers

#### Scenario: A plan of recurring events only

- **WHEN** a plan has no point events and no checkpoints
- **THEN** all of its recurring occurrences are drawn, since nothing else bounds the path

#### Scenario: The jump from recruitment is marked

- **WHEN** the first event month is later than the recruitment month
- **THEN** a break marker between them indicates that the axis is not proportional

#### Scenario: Exporting to PDF

- **WHEN** the user clicks the PDF export button
- **THEN** a PDF of the same diagram downloads, rendered locally (no external services)

#### Scenario: The export matches what was on screen

- **WHEN** the diagram is exported, or viewed in a different browser
- **THEN** every element of it renders — including the legend's icon and per-event colour markers — with no part missing, resized or displaced relative to the on-screen view

#### Scenario: Air-gap safety

- **WHEN** the system runs in the air-gapped image
- **THEN** the diagram and its PDF export work with no network access and no packages beyond those already baked

### Requirement: Editing existing plan events

The Admin SHALL be able to edit any event already defined in a plan: a point event's label and offset; a cumulative metric's name and unit, and each of its checkpoints' target and offset; and a recurring event's label, interval, and stop month. Recorded person progress SHALL survive an edit of the event it belongs to.

#### Scenario: Editing a point event

- **WHEN** the Admin changes a point event's label or offset
- **THEN** the plan reflects the change, and people who already completed that event keep their completion

#### Scenario: Editing a metric and its checkpoints

- **WHEN** the Admin changes a metric's unit or a checkpoint's target
- **THEN** the plan reflects the change and recorded metric values are preserved

#### Scenario: Editing a recurring event

- **WHEN** the Admin changes a recurring event's interval or stop month
- **THEN** occurrences are recomputed from the new definition, and content already filed against existing occurrences is preserved

### Requirement: Distinct colors per event

Each recurring event and each cumulative metric SHALL carry a stable, visually distinct color drawn automatically from a soft palette, so multiple events of the same kind can be told apart. The color SHALL be applied consistently on the plan page and in the career-path diagram, and SHALL NOT change when other events are added or removed.

#### Scenario: Several recurring events

- **WHEN** a plan defines more than one recurring event
- **THEN** each is rendered in its own color, on the page and in the diagram

#### Scenario: Colors are stable

- **WHEN** an event is deleted or a new one added
- **THEN** the colors of the remaining events stay as they were

#### Scenario: Readable palette

- **WHEN** colors are assigned
- **THEN** they come from a soft palette chosen for legibility of the text placed on them
