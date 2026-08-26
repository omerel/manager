# career-plans — delta

## ADDED Requirements

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
