## ADDED Requirements

### Requirement: Offsets are written as years and months

Every recruitment-anchored offset in a career plan — point events, metric checkpoints, and a recurring event's start and stop — SHALL be authored and displayed in years.months notation: the integer part is years, the digits after the dot are months (`3.4` = 3 years and 4 months). The month part SHALL be read positionally from the entered text, never from a numeric value, so `3.1` means one month and `3.10` means ten; a month part above 11 SHALL be rejected. The recurring interval SHALL remain in months and is exempt from the notation. Stored values SHALL remain integer months, unchanged in meaning.

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

## MODIFIED Requirements

### Requirement: Recurring event

A career plan SHALL support **recurring events** (אירוע מחזורי): an event defined once with a fixed interval that auto-unrolls into occurrences along the timeline (e.g. an evaluation every 6 months). A recurring event SHALL declare a **required start offset** — the first occurrence falls at the start itself — and SHALL stop at a **required month offset from recruitment**; occurrences run start, start + interval, start + 2·interval … up to and including the stop. Stopping "at the person's end of service" SHALL NOT be offered as an authoring option, because that date is unknown for most people and a plan must describe the same schedule for everyone assigned to it. The system SHALL NOT substitute a default or horizon for a missing start or stop offset.

#### Scenario: Unrolling occurrences from a start

- **WHEN** a manager defines a recurring evaluation every 12 months starting at 2.0 and stopping at 6.0
- **THEN** the system SHALL generate occurrences at 2.0, 3.0, 4.0, 5.0 and 6.0, and none before the start or beyond the stop

#### Scenario: Start offset is required

- **WHEN** a manager tries to save a recurring event without a start
- **THEN** the system SHALL reject it rather than beginning the cycle at recruitment on the manager's behalf

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
- **THEN** each existing event's occurrences remain exactly the offsets it produced before — the first at one interval after recruitment
