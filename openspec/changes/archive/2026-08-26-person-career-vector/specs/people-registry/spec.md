# people-registry — delta

## ADDED Requirements

### Requirement: The person card shows their career vector

A person carrying an assigned plan SHALL see that plan drawn as a career vector on their card, alongside their personal details — the details on the primary (right) side, the vector on the left — with the existing textual event lists retained: the drawing is for seeing the path, the lists are where progress is recorded.

The vector SHALL be rendered from the person's own plan at the moment the card is opened, storing nothing, and SHALL be coloured by **that person's** status per event: in gap, approaching, waived, or met. Movement SHALL be reserved for the states that ask for action, and SHALL be suppressed for a viewer who has asked their system for reduced motion, colour alone then carrying the meaning. A personal event SHALL be distinguishable on the drawing from the events the track requires. Because the drawing is reduced to fit its column, it SHALL be enlargeable to fill the screen, and SHALL be exportable as a PDF carrying the same colours — available only to a user who may already see that person.

#### Scenario: Opening a card

- **WHEN** a user opens the card of a person assigned a plan
- **THEN** the plan is drawn as a vector beside their details, and every event carries the colour of that person's status against it

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
