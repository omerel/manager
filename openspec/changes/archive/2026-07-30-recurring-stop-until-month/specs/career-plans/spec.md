## MODIFIED Requirements

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

The plan detail page SHALL present the plan as a schematic career-path diagram: a large upward arrow from recruitment (base) toward end of service (tip), with **recruitment at the base and, above it, one evenly spaced tick per month in which the plan has an event** — point events and metric checkpoints as labeled, iconed cards alternating sides of the arrow, and recurring events as cadence markers with a legend. Each tick SHALL be labeled with its month offset, and a single break marker SHALL mark the jump from recruitment to the first event month. Recurring cadence markers SHALL be drawn only across the span occupied by the plan's point events and metric checkpoints — from the earliest to the latest — while the legend continues to state each recurring event's real definition. The diagram's height SHALL depend on how many event months are drawn, not on how far into the future the plan extends. The user SHALL be able to export the diagram as a PDF suitable for presentations.

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
