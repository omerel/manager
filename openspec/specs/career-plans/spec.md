# career-plans

## Purpose

תבניות תכנית קריירה יחסיות-לגיוס בעריכת אדמין: אירועים נקודתיים, מדדים מצטברים ואירועים מחזוריים; העתקה ועריכה.

## Requirements

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

### Requirement: Copying a plan

The system SHALL allow the Admin to copy an existing plan to produce a new, independent plan that can be edited without affecting the original.

#### Scenario: Copy produces an independent plan

- **WHEN** a manager copies plan A to create plan B and then edits plan B
- **THEN** plan A remains unchanged

### Requirement: Point event

A career plan SHALL support **point events** (אירוע נקודתי): one-time, binary items placed at a month offset (e.g. finish basic training, transition to second/third role).

#### Scenario: Defining a point event

- **WHEN** a manager adds a point event "transition to second role" at +4 months
- **THEN** the event is tracked as binary (done / not done) against the person's placement-anchored date

### Requirement: Cumulative metric

A career plan SHALL support **cumulative metrics** (אירוע מצטבר): a named, unit-bearing measure that accumulates over time and carries one or more timed interim targets (e.g. training-grant hours reaching 100 by +6mo, 300 by +12mo; grant money reaching ₪1000 by +9mo).

#### Scenario: Defining a metric with interim targets

- **WHEN** a manager defines a metric "grant hours" with targets 100@+6mo and 300@+12mo
- **THEN** the plan represents a stepped planned curve against which the person's actual accumulated value can be compared

#### Scenario: Comparing planned vs actual

- **WHEN** a person has accumulated 247 of a 300-hour target due at +12mo
- **THEN** the system SHALL be able to report the actual value against the planned target at that offset

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

### Requirement: An admin can delete a career plan template

The plans list SHALL offer the Admin, and only the Admin, a control that deletes a plan template. The control SHALL NOT appear for other roles, and the deletion SHALL be refused on the server when requested by a non-admin.

Deleting a template SHALL remove the template and the events, metrics, checkpoints and recurrences defined on it. It SHALL NOT be offered for a person's plan copy: a copy belongs to an assignment, and ending the assignment is how a person leaves a plan.

#### Scenario: An admin deletes a template

- **WHEN** the Admin confirms deletion of a plan template
- **THEN** the template and its items are removed and it no longer appears in the plans list or as a choice when assigning a plan

#### Scenario: A manager cannot delete

- **WHEN** a user who is not the Admin views the plans list
- **THEN** no delete control is offered for any plan

#### Scenario: Copies are not offered for deletion

- **WHEN** the plans list is displayed
- **THEN** only templates are listed, and no control deletes a person's own plan copy

### Requirement: Deleting a template does not disturb the people assigned to it

A template SHALL be deletable while people are assigned copies of it. Those people SHALL keep their plan copy, their recorded progress and their gap status exactly as they were: what they are measured against is their own copy, and the template is only what that copy was made from.

The name of the plan SHALL remain readable everywhere it is shown, including in the plan history of people who left it, because the name is recorded on the assignment when it is made and does not depend on the template surviving.

#### Scenario: Deleting a template that people are on

- **WHEN** the Admin deletes a template that people currently hold copies of
- **THEN** those people keep their plan, their progress and their gap status, and nothing about their record changes

#### Scenario: The plan name in the people list

- **WHEN** the people list is shown after the template was deleted
- **THEN** each affected person still shows the name of their plan, without a link, rather than appearing to have no plan

#### Scenario: The plan name in a person's history

- **WHEN** a person's card shows a plan they were previously assigned whose template has since been deleted
- **THEN** the plan is still named in their history

### Requirement: A template deletion is confirmed with its consequence stated

The Admin SHALL be shown, before confirming, how many items the template defines and how many people currently hold a copy of it — counted across the whole system, not clipped to what the Admin manages. The confirmation SHALL state explicitly that those people are not affected apart from losing the link from their plan name to the template.

#### Scenario: Opening the confirmation for a template in use

- **WHEN** the Admin chooses to delete a template that people are assigned
- **THEN** the confirmation names the template, states how many people hold a copy, and states that their plans and progress are unaffected

#### Scenario: A template nobody is on

- **WHEN** the Admin chooses to delete a template with no copies
- **THEN** the confirmation says so rather than showing a warning about people who do not exist

#### Scenario: Declining

- **WHEN** the Admin closes the confirmation without confirming
- **THEN** nothing is deleted

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

### Requirement: A personal point event for one person

A commander holding establishment authority — a grant at section (רמ״ד) level or above covering the person's framework — SHALL be able, **while editing the card**, to add a point event that belongs to that person alone: a label and an offset in years.months from their unit placement. The event SHALL be recorded on the person's own plan copy, marked as personal so it is never mistaken for one the track requires, and SHALL name who added it.

A personal event SHALL behave as any other point event: it is measured against the same dates, it counts toward the person's gaps, it may be marked done, and it may be waived. When the person is assigned another plan, their personal events SHALL travel to the new copy — they belong to the person, not to the track. Adding one SHALL require an assigned plan; without one the action SHALL refuse and say so.

#### Scenario: A section head adds a personal event

- **WHEN** a commander with establishment authority over the person's framework adds «חפיפה עם הקודם» at +3 months
- **THEN** the event appears on that person's plan and on nobody else's, marked as personal and naming who added it

#### Scenario: Reading the card offers no such control

- **WHEN** the same commander opens the card without entering edit mode
- **THEN** the add form is absent — adding an obligation is a change, not a way to read

#### Scenario: Below section level it is refused

- **WHEN** a Manager whose grant is at team level attempts to add a personal event
- **THEN** the action is refused, exactly as enrolling a person would be

#### Scenario: A personal event is a real obligation

- **WHEN** a personal event's date passes without it being marked done
- **THEN** the person is in gap over it, as they would be over a plan event

#### Scenario: It travels with the person

- **WHEN** a person carrying a personal event is assigned a different plan
- **THEN** the personal event is present on the new plan copy, while the outgoing track's own events are not

#### Scenario: No plan, no personal event

- **WHEN** a commander adds a personal event to a person with no assigned plan
- **THEN** the action is refused with a message saying a plan must be assigned first

### Requirement: A plan item may carry a format or guidance file

A point event and a recurring event in a career plan MAY carry one attached file, authored under «פורמטים והנחיות» by the Admin in the plan editor — the format to be filled in, or the guidance for the event. A cumulative metric SHALL NOT take one. Uploading a file where one already exists SHALL replace it, and the replaced file SHALL NOT be retained.

Where a person is assigned a plan, the file SHALL be offered for download at that event on their card — at **every occurrence** of a recurring event, each occurrence needing the same form. The file offered SHALL be the one the template carries **at the moment it is asked for**, not one captured when the person was assigned: a guideline is the document that applies now. An event with no file offers nothing, and a personal event — belonging to no template item — never carries one.

Deleting a plan item SHALL delete its file. A person assigned before this capability existed carries no link to their template items and SHALL therefore be offered nothing, rather than being offered a guess.

#### Scenario: Authoring a guideline

- **WHEN** the Admin attaches «טופס-הגשה.docx» to a point event in a template
- **THEN** everyone assigned that plan is offered that file for download at that event on their card

#### Scenario: The guideline stays current

- **WHEN** the Admin replaces the attached file with a newer version
- **THEN** already-assigned people are offered the new file, and the replaced one is not retained

#### Scenario: A recurring event's file repeats

- **WHEN** a recurring event carries a file
- **THEN** each of its occurrences on a person's card offers that same file

#### Scenario: Removing the item removes the file

- **WHEN** the Admin deletes a plan item that carries a file
- **THEN** the file is deleted and no longer offered anywhere

#### Scenario: Nothing to offer

- **WHEN** an event carries no file, or is a personal event, or belongs to a copy made before this capability
- **THEN** no download is offered at it
