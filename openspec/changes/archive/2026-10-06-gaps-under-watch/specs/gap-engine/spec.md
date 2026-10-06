## ADDED Requirements

### Requirement: A gap can be marked as under watch

A commander SHALL be able to mark an outstanding gap as **under watch** (״במעקב״), declaring that it is known and being handled, and SHALL be able to clear that mark. The mark SHALL be available on every kind of plan item that can be in gap — a point event, a cumulative metric, and a recurring occurrence alike.

Marking SHALL require the same authority as marking an item complete: the commander closest to the person, or above them.

**Being under watch SHALL NOT change what the item IS.** The item remains overdue, is counted as overdue wherever gaps are counted, and contributes to a person's and a framework's standing exactly as it did before being marked. The mark distinguishes a known gap from a new one; it does not reduce the number of gaps, and no sequence of marking SHALL make a person or a framework appear to have fewer.

The note explaining the watch SHALL live in the field that item already has for a note, rather than in a field added for this purpose.

#### Scenario: Marking does not move the count

- **WHEN** a commander marks several overdue items as under watch
- **THEN** the overdue count for that person, and for every framework above them, is exactly what it was before

#### Scenario: Every kind of item can be watched

- **WHEN** a commander opens a person carrying an overdue point event, a metric short of its target, and an unfilled recurring occurrence
- **THEN** each of the three can be marked as under watch

#### Scenario: Only a commander may mark

- **WHEN** a user without edit authority over the person attempts to mark or clear a watch
- **THEN** the system SHALL refuse, on the server, whatever the interface offered

#### Scenario: Completing clears the question

- **WHEN** an item under watch is subsequently completed
- **THEN** it reads as met, and the watch no longer applies to it

### Requirement: A watch expires on its own

A watch SHALL cease to apply after a configured period, one month by default, counted from when it was placed. The period SHALL be an Admin setting, changeable without a deployment.

An expired watch SHALL return the item to being an ordinary gap — **never to being met**. A watch going stale is the absence of attention, and absence of attention SHALL NOT be able to close a gap. Where an item's completion would otherwise be inferred from content written while it was under watch, expiry SHALL resolve it as a gap and not as met: a wrongly red item costs a commander a glance, while a wrongly green one costs an obligation nobody sees again.

#### Scenario: A watch left untouched

- **WHEN** an item has been under watch for longer than the configured period
- **THEN** it is presented as an ordinary overdue gap again, and is no longer counted among those under watch

#### Scenario: Expiry never closes a gap

- **WHEN** a watch expires on an item whose completion could be inferred from content filed during the watch
- **THEN** the item is a gap, not met

#### Scenario: The Admin changes the period

- **WHEN** the Admin changes the watch period in settings
- **THEN** watches are measured against the new period, with no deployment

### Requirement: The dashboard separates known gaps from new ones

The dashboard SHALL report, alongside the overdue count it already reports, how many of those are under watch. The overdue figure itself SHALL be unchanged by the presence of watches, so that a figure on the dashboard never means two things depending on whether anyone has been marking.

The narrowing control SHALL gain a choice for gaps that are overdue and NOT under watch — what is new and unattended — alongside the choices it already offers.

The compliance gauge and the per-framework comparison SHALL continue to measure overdue in every case, watched or not, as they already do for every other narrowing.

#### Scenario: A framework reports both figures

- **WHEN** a manager views a framework with twelve overdue items, eight of them under watch
- **THEN** the dashboard shows twelve overdue and notes that eight are under watch

#### Scenario: Narrowing to what is new

- **WHEN** a manager narrows to gaps that are overdue and not under watch
- **THEN** the lists carry only those, which is what has appeared or been ignored rather than what is being handled

#### Scenario: The headline figure still does not move

- **WHEN** a manager switches between any of the narrowing choices, including the new one
- **THEN** the compliance gauge and the per-framework bars show the same figures throughout

#### Scenario: Two frameworks with the same count

- **WHEN** two frameworks each carry five overdue items, and one has marked all five while the other has marked none
- **THEN** both report five overdue, and the dashboard distinguishes them by how many are under watch

## MODIFIED Requirements

### Requirement: Gap states

The system SHALL classify each plan item into gap states: ⬜ future (date not yet reached), 🟡 approaching or in-progress, and 🔴 overdue-and-short / missed. A missed point event and an unfilled recurring occurrence past its date SHALL both resolve to 🔴.

These states SHALL remain the whole of the classification. Being under watch is carried ALONGSIDE a state and SHALL NOT become one of them: an item under watch is overdue and marked, so that everything which counts, rolls up, exports or reasons over gap states continues to do so without knowing the mark exists.

#### Scenario: Approaching state

- **WHEN** an item's anchored date is within the approaching window and it is not yet met
- **THEN** its state SHALL be 🟡

#### Scenario: Unfilled recurring occurrence is a gap

- **WHEN** a recurring evaluation occurrence's date has passed and no content was filed
- **THEN** its state SHALL be 🔴 and it SHALL count as a gap in rollups

#### Scenario: A watched item keeps its state

- **WHEN** an overdue item is marked as under watch
- **THEN** its gap state is still 🔴, and anything reading gap states sees exactly what it saw before

### Requirement: The dashboard can be narrowed to a kind of gap

The dashboard SHALL offer a choice of gap kind — approaching, overdue, overdue-and-not-under-watch, or all — which SHALL narrow the lists of people: the needs-attention panel and the people listed under each team in the org tree.

The compliance gauge and the per-framework comparison SHALL NOT change with this choice. They SHALL continue to measure overdue in every case, so that a single figure on the dashboard never means two different things depending on a control that may have been forgotten.

"All" SHALL mean no narrowing, expressed in each list's own terms: the tree keeps every person including those meeting their plan, and the needs-attention panel carries both the overdue and the approaching.

#### Scenario: Narrowing to approaching

- **WHEN** a manager chooses approaching
- **THEN** the needs-attention panel lists the people with an approaching item, and the tree lists only those people under each team

#### Scenario: The headline figure does not move

- **WHEN** a manager switches between approaching, overdue and all
- **THEN** the compliance gauge and the per-framework bars show the same figures throughout

#### Scenario: All keeps the tree whole

- **WHEN** the choice is all
- **THEN** the tree lists every person under a team, including those meeting their plan

#### Scenario: All widens the needs-attention panel

- **WHEN** the choice is all
- **THEN** the needs-attention panel lists both the overdue and the approaching, distinguished from each other

#### Scenario: Overdue reproduces the earlier behaviour

- **WHEN** the choice is overdue
- **THEN** the needs-attention panel lists exactly the people it listed before this capability existed

#### Scenario: Overdue includes the watched

- **WHEN** the choice is overdue
- **THEN** items under watch are among those listed — the choice is about the state, and being watched is not a state
