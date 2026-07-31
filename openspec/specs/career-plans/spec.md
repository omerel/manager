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

### Requirement: Transferring a person between plans

A person SHALL be able to move from one career plan to another without losing what they achieved on the previous one. Assigning a new plan SHALL end the current assignment rather than delete it: the previous plan copy, and every milestone, metric reading and filed evaluation recorded against it — including documents attached to those evaluations — SHALL be retained. Each assignment SHALL record which plan, when it began, when it ended, and why the person moved.

#### Scenario: Moving to another plan

- **WHEN** an edit-level Manager assigns a different plan to a person who already has one
- **THEN** the previous assignment is ended and kept with all of its recorded progress and attached documents, and the person begins a new assignment

#### Scenario: Nothing is lost

- **WHEN** a person who had completed milestones, recorded metric values and filed evaluations is moved to another plan
- **THEN** none of those records are removed, and they remain readable against the plan they were recorded for

#### Scenario: Removing a plan without replacing it

- **WHEN** a person's plan is unassigned
- **THEN** the assignment is ended and retained, and the person is left with no active plan

#### Scenario: The reason is recorded

- **WHEN** a transfer is confirmed
- **THEN** the reason given for the move is stored with the assignment

### Requirement: Waivers for items that predate an assignment

Items of a newly assigned plan whose offset falls at or before the person's tenure at the moment of assignment SHALL NOT count as gaps. The waiver line SHALL be derived from the assignment date rather than entered by hand, and SHALL apply to point events, metric checkpoints and recurring occurrences alike. Before confirming, the Admin SHALL be able to turn individual items back on, or waive individual items that fall after the line. This rule SHALL apply to a person's first assignment exactly as it does to a transfer.

#### Scenario: Assigning a plan mid-career

- **WHEN** a person 40 months into service is assigned a plan whose earliest events sit at months 9 and 24
- **THEN** those events do not count as gaps, and the person is not reported as overdue for them

#### Scenario: Overriding the default

- **WHEN** the Admin marks a waived item as still required, or waives an item that falls after the line
- **THEN** the override is stored and the gap calculation follows it rather than the line

#### Scenario: An item added to the plan later

- **WHEN** an item is added to a person's plan at an offset before the waiver line
- **THEN** it is waived on the same basis as the others, without needing a separate decision

#### Scenario: First plan for a long-serving person

- **WHEN** a person recruited three years ago is assigned their first plan
- **THEN** items before month 36 are waived by default, as they would be for a transfer

### Requirement: Carry-over between plans is an explicit decision

During assignment the Admin SHALL be able to map items from the person's previous plan onto the new one, so that accumulated values and completed milestones are not reset. The system SHALL offer candidate matches but SHALL NOT apply any of them automatically. A carried item SHALL remain recorded on the previous assignment and SHALL be marked on the new one as carried, identifying where it came from.

#### Scenario: Carrying an accumulated value

- **WHEN** the Admin maps a cumulative metric from the previous plan to a metric in the new one
- **THEN** the recorded value is applied to the new plan's metric, and the next checkpoint is measured against it rather than against zero

#### Scenario: Not repeating a completed milestone

- **WHEN** a point event already completed on the previous plan appears again in the new one
- **THEN** the Admin can map it, the new plan's item is marked complete with the original completion date, and the person is not asked to do it again

#### Scenario: Nothing is matched automatically

- **WHEN** the new plan contains an item with the same name and unit as one in the previous plan
- **THEN** it is offered as a candidate but is not applied unless the Admin selects it

#### Scenario: A carried item states its origin

- **WHEN** an item was completed by carry-over
- **THEN** the person's card shows that it was carried and from which plan, rather than presenting it as work done under the current plan

### Requirement: Warn when a plan cannot measure anything

If every item of the plan being assigned falls at or before the waiver line, the system SHALL say so before the assignment is confirmed, because the person would otherwise appear compliant with nothing being measured. The assignment SHALL remain possible.

#### Scenario: Plan shorter than the person's service

- **WHEN** a plan whose last event is at month 24 is assigned to a person 40 months into service
- **THEN** the system warns that no item would be measured, and still allows the assignment to be confirmed
