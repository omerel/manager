## MODIFIED Requirements

### Requirement: The person card shows their career vector

A person carrying an assigned plan SHALL see that plan drawn as a career vector on their card, alongside their personal details — the details on the primary (right) side, the vector on the left — with the existing textual event lists retained: the drawing is for seeing the path, the lists are where progress is recorded.

The vector SHALL be rendered from the person's own plan at the moment the card is opened, storing nothing, and SHALL be coloured by **that person's** status against **each item the drawing actually shows** — never against the item's definition. A recurring event is drawn once per occurrence, so each occurrence SHALL carry its own status, decided by that occurrence's own date and its own filed content; the states of an event's other occurrences SHALL NOT reach it. This SHALL hold for both ways a recurring event is drawn — a card at each occurrence, or a cadence marker at each occurrence.

The statuses SHALL be: in gap, **in gap and under watch**, approaching, met, waived, and **not yet due** — the last for an item whose date is still ahead and which has not been done, drawn in a neutral colour that reads as neither achievement nor fault. Being not yet due SHALL be distinguished from being met: an item completed ahead of its date reads as met, not as pending. The neutral state SHALL apply to every kind of future item the drawing shows — point event, metric checkpoint and recurring occurrence alike — so that two items falling in the same month are never coloured differently for the same reason. An item in gap that has been marked as under watch SHALL be drawn in a colour of its own, distinct from both an unattended gap and a met item, so that a glance separates what is known from what is new. It remains a gap: the colour says who is looking at it, not whether it is outstanding. Every state the drawing uses SHALL appear in its legend.

Movement SHALL be reserved for the states that ask for action, and SHALL be suppressed for a viewer who has asked their system for reduced motion, colour alone then carrying the meaning. A personal event SHALL be distinguishable on the drawing from the events the track requires. Because the drawing is reduced to fit its column, it SHALL be enlargeable to fill the screen, and SHALL be exportable as a PDF carrying the same colours — available only to a user who may already see that person.

The drawing and the textual lists on the same card SHALL agree about every occurrence: a card that marks one occurrence overdue in its list and a different number of them overdue in its drawing is stating two different facts about the same data.

The vector SHALL show **the path required of that person**, not the track's full schedule. Where a person's occurrences are clipped — by their end of service, or by anything else that decides what is asked of them — the drawing SHALL be clipped with them. An occurrence that will never be required of this person SHALL NOT appear on their card: drawing it is a false statement about what they owe, not merely a missing colour.

Every item the vector draws SHALL carry a status. A drawn item with no status SHALL be treated as a fault and SHALL be detectable as one, rather than falling back to a colour that reads as a verdict nobody reached.

#### Scenario: Opening a card

- **WHEN** a user opens the card of a person assigned a plan
- **THEN** the plan is drawn as a vector beside their details, and every item drawn carries the colour of that person's status against that item

#### Scenario: One overdue occurrence does not condemn the rest

- **WHEN** a person has a recurring event whose earlier occurrences were filled, one past occurrence left unfilled, and later occurrences still ahead
- **THEN** the filled occurrences read as met, the unfilled past one reads as in gap, the future ones read as not yet due, and each is coloured for itself alone

#### Scenario: The drawing and the list agree

- **WHEN** the textual list on a card marks a given number of recurring occurrences as overdue
- **THEN** the drawing on that same card marks exactly those occurrences and no others

#### Scenario: A future item is not shown as done

- **WHEN** an item's date is still ahead and nothing has been recorded against it
- **THEN** it is drawn in the neutral not-yet-due colour, and never in the colour of a met item

#### Scenario: Completed early still reads as met

- **WHEN** an occurrence is filled before its date arrives
- **THEN** it reads as met rather than as not yet due

#### Scenario: Future items of different kinds agree

- **WHEN** a point event and a recurring occurrence both fall in a month still ahead, with nothing recorded against either
- **THEN** both are drawn in the same neutral colour

#### Scenario: Both drawings of a recurring event obey the rule

- **WHEN** a recurring event is drawn as cadence markers rather than as cards
- **THEN** each marker carries its own occurrence's status, exactly as the cards would

#### Scenario: The legend names the neutral state

- **WHEN** the vector is shown, or exported as a PDF
- **THEN** its legend lists the not-yet-due state alongside the others it uses

#### Scenario: The drawing follows the person, not the template

- **WHEN** the template a person was assigned from is edited afterwards
- **THEN** their vector continues to show the plan they are actually measured against

#### Scenario: Reduced motion is honoured

- **WHEN** the viewer's system asks for reduced motion
- **THEN** the vector is still coloured by status but does not animate

#### Scenario: Enlarging the drawing

- **WHEN** a user clicks the plan drawing on a person's card
- **THEN** it opens filling the screen, at a size its labels can be read at, and closes again on Escape or a click outside it

#### Scenario: Exporting the person's plan

- **WHEN** a user who may see the person exports their plan
- **THEN** they receive a PDF of that person's drawing in their own status colours, named for them; a user who may not see the person receives nothing

#### Scenario: A person with no plan

- **WHEN** the person has no assigned plan
- **THEN** no vector is drawn and the card reads as it does today

#### Scenario: Occurrences beyond the person's service

- **WHEN** a person's plan schedules recurring occurrences past their end-of-service date
- **THEN** those occurrences do not appear on their card at all, the drawing ending where what is asked of them ends

#### Scenario: The plan page still shows the whole track

- **WHEN** the same plan is viewed on the plan page, where there is no person
- **THEN** the full schedule is drawn, unclipped and uncoloured by any status

#### Scenario: A drawn item without a status

- **WHEN** the drawing is given a status map and renders an item the map has no entry for
- **THEN** that is a fault the system can detect, and the item is never quietly painted in a colour that looks like a verdict

#### Scenario: A watched gap is drawn apart from a new one

- **WHEN** a person carries two overdue items and one of them is under watch
- **THEN** the two are drawn in different colours, and neither reads as met

#### Scenario: Marking and clearing from the card

- **WHEN** a commander opens a person's card on an outstanding item
- **THEN** they can mark it as under watch and clear that mark, alongside the control that marks it complete

#### Scenario: A watch note is not mistaken for a record

- **WHEN** a recurring occurrence is under watch and carries the text explaining the watch
- **THEN** that text is presented as a watch note rather than as the evaluation summary, until the watch is cleared

