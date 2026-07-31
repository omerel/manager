## ADDED Requirements

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
