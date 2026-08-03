## ADDED Requirements

### Requirement: A recurring event chooses how it is drawn

Each recurring event SHALL carry a display mode, chosen when it is authored: drawn as a **marker on the axis** (the default) or as a **labelled card at every one of its occurrences**, in the same form point events and checkpoints take. An event drawn as cards SHALL NOT also be drawn as markers — one event has one representation.

Each recurring event SHALL keep its own colour, and whichever form it takes SHALL carry that colour, so that several recurring events on one plan stay tellable apart.

The authoring control SHALL state the consequence of the card mode, since a frequent event over a long plan produces a card per occurrence.

#### Scenario: The default

- **WHEN** the Admin adds a recurring event without choosing a display mode
- **THEN** it is drawn as markers on the axis

#### Scenario: Drawn as labelled cards

- **WHEN** a recurring event that unrolls to twelve occurrences is set to the card display
- **THEN** the diagram shows a labelled card at each of the twelve occurrences, in that event's colour, and no markers for it

#### Scenario: Telling two labelled recurrences apart

- **WHEN** two recurring events are both drawn as cards
- **THEN** each event's cards carry its own colour

## MODIFIED Requirements

### Requirement: Career plan as a relative-to-unit-placement template

A career plan SHALL be a reusable template whose timeline is defined at month granularity **relative to a person's unit placement date** (offsets such as +1mo, +9mo, +12mo), so that one template can serve many people regardless of when each arrived. A plan measures a path within this unit; anchoring it to recruitment would measure time served elsewhere as though it had been served here. Only the Admin (מנהלן) SHALL author or edit plan templates.

Every offset in a plan — point events, metric checkpoints, and a recurring event's start, stop and each unrolled occurrence — SHALL resolve to a calendar date through the placement date. No part of the system SHALL resolve a plan offset through any other date.

#### Scenario: Authoring a plan with month offsets

- **WHEN** the Admin adds an event to a plan at offset +12 months
- **THEN** the plan stores the event as a relative offset, not an absolute calendar date

#### Scenario: One anchor everywhere

- **WHEN** the same plan item is shown on the person's card, counted by the gap engine, previewed on assignment and drawn on the diagram
- **THEN** all four resolve it to the same calendar date, computed from the placement date

#### Scenario: Managers cannot author templates

- **WHEN** a Manager attempts to create or edit a plan template
- **THEN** the system SHALL deny the action, as template authoring is Admin-only

#### Scenario: The anchor is named accurately

- **WHEN** an offset is displayed anywhere — a plan item, an occurrence list, the diagram's axis or its origin
- **THEN** the wording names unit placement as what the offset is measured from, rather than recruitment

### Requirement: Waivers for items that predate an assignment

Items of a newly assigned plan whose offset falls at or before the person's tenure **in this unit** at the moment of assignment SHALL NOT count as gaps. The waiver line SHALL be measured from the placement date — the same axis the plan itself uses — and SHALL be derived from the assignment date rather than entered by hand, applying to point events, metric checkpoints and recurring occurrences alike. Before confirming, the Admin SHALL be able to turn individual items back on, or waive individual items that fall after the line. This rule SHALL apply to a person's first assignment exactly as it does to a transfer.

#### Scenario: Assigning a plan mid-path

- **WHEN** a person 40 months into their placement in this unit is assigned a plan whose earliest events sit at months 9 and 24
- **THEN** those events do not count as gaps, and the person is not reported as overdue for them

#### Scenario: Someone who arrived recently after long service

- **WHEN** a person recruited five years ago but placed here three months ago is assigned a plan
- **THEN** almost nothing is waived, because the line reflects their time in this unit rather than their total service

#### Scenario: Overriding the default

- **WHEN** the Admin marks a waived item as still required, or waives an item that falls after the line
- **THEN** the override is stored and the gap calculation follows it rather than the line

#### Scenario: An item added to the plan later

- **WHEN** an item is added to a person's plan at an offset before the waiver line
- **THEN** it is waived on the same basis as the others, without needing a separate decision

### Requirement: Point event

A career plan SHALL support **point events** (אירוע נקודתי): one-time, binary items placed at a month offset (e.g. finish basic training, transition to second/third role).

#### Scenario: Defining a point event

- **WHEN** a manager adds a point event "transition to second role" at +4 months
- **THEN** the event is tracked as binary (done / not done) against the person's placement-anchored date

### Requirement: Recurring event

A career plan SHALL support **recurring events** (אירוע מחזורי): an event defined once with a fixed interval that auto-unrolls into occurrences along the timeline (e.g. an evaluation every 6 months). A recurring event SHALL declare a **required start offset** — the first occurrence falls at the start itself — and SHALL stop at a **required month offset from unit placement**; occurrences run start, start + interval, start + 2·interval … up to and including the stop. Stopping "at the person's end of service" SHALL NOT be offered as an authoring option, because that date is unknown for most people and a plan must describe the same schedule for everyone assigned to it. The system SHALL NOT substitute a default or horizon for a missing start or stop offset.

#### Scenario: Unrolling occurrences from a start

- **WHEN** a manager defines a recurring evaluation every 12 months starting at 2.0 and stopping at 6.0
- **THEN** the system SHALL generate occurrences at 2.0, 3.0, 4.0, 5.0 and 6.0, and none before the start or beyond the stop

#### Scenario: Start offset is required

- **WHEN** a manager tries to save a recurring event without a start
- **THEN** the system SHALL reject it rather than beginning the cycle at placement on the manager's behalf

#### Scenario: Start after stop is rejected

- **WHEN** a manager enters a start offset later than the stop offset
- **THEN** the system SHALL reject the combination

#### Scenario: Stop offset is required

- **WHEN** a manager tries to save a recurring event without a stop month
- **THEN** the system SHALL reject it rather than choosing a stop month on the manager's behalf

#### Scenario: The plan schedules everyone identically

- **WHEN** two people are assigned the same plan
- **THEN** the recurring event unrolls to the same set of month offsets for both, independent of anything recorded on either person

#### Scenario: Existing events keep their schedule

- **WHEN** the start offset is introduced to a system with recurring events already defined
- **THEN** each existing event's occurrences remain exactly the offsets it produced before — the first at one interval after the placement date

### Requirement: Visual career-path diagram with PDF export

The plan detail page SHALL present the plan as a schematic career-path diagram: a large upward arrow from unit placement (base) toward end of service (tip), with **unit placement at the base and, above it, one evenly spaced tick per month in which the plan has an event** — point events and metric checkpoints as labeled, iconed cards alternating sides of the arrow, and recurring events as cadence markers with a legend carrying the recurring icon and, per event, its own colour marker matching the markers on the arrow. Each tick SHALL be labeled with its month offset, and a single break marker SHALL mark the jump from placement to the first event month. Recurring cadence markers SHALL be drawn only across the span occupied by the plan's point events and metric checkpoints — from the earliest to the latest — while the legend continues to state each recurring event's real definition. The diagram's height SHALL depend on how many event months are drawn, not on how far into the future the plan extends. The user SHALL be able to export the diagram as a PDF suitable for presentations.

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

#### Scenario: The jump from placement is marked

- **WHEN** the first event month is later than the placement month
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

### Requirement: Offsets are written as years and months

Every placement-anchored offset in a career plan — point events, metric checkpoints, and a recurring event's start and stop — SHALL be authored and displayed in years.months notation: the integer part is years, the digits after the dot are months (`3.4` = 3 years and 4 months). The month part SHALL be read positionally from the entered text, never from a numeric value, so `3.1` means one month and `3.10` means ten; a month part above 11 SHALL be rejected. The recurring interval SHALL remain in months and is exempt from the notation. Stored values SHALL remain integer months, unchanged in meaning.

#### Scenario: Authoring a point event in the notation

- **WHEN** the admin enters `3.4` as a point event's offset
- **THEN** the event is stored at 40 months and displayed as `3.4`

#### Scenario: Ten months is not one month

- **WHEN** the admin enters `2.10`
- **THEN** the value is 2 years and 10 months (34 months), distinct from `2.1` (25 months)

#### Scenario: An impossible month part

- **WHEN** the admin enters `2.12`
- **THEN** the input is rejected with an explanation rather than silently reinterpreted

#### Scenario: Only a malformed value gets a caption

- **WHEN** the admin types into a notation field
- **THEN** a valid value shows no text under the field, and a malformed one (month part above 11, or not `Y.M`) shows the format error inline — an always-on readback was tried and removed at the user's request, because a caption under every field read as clutter

#### Scenario: Diagram time labels stay legible

- **WHEN** the diagram draws its years.months axis labels on a page whose direction is RTL
- **THEN** each label extends away from the axis, clear of the recurring-event markers, with its text direction pinned rather than inherited — under RTL, an inherited direction flips the SVG anchor and extends the label into the markers
