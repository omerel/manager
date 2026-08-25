# evaluations-and-events — delta

## ADDED Requirements

### Requirement: A recurring event may ask for a rating

A recurring event SHALL carry an authoring-time option «מילוי עם דירוג»: when set, filling one of its occurrences SHALL offer the same optional five-point rating an interview summary offers — «ללא דירוג» an explicit choice, a value outside 1–5 refused, never clamped. The rating is stored on the fill entry and displayed with its scale label wherever the filled occurrence shows. Events without the option SHALL offer no rating field and store no rating. Assigning a plan SHALL carry the option onto the person's copy.

#### Scenario: Authoring a rated recurring event

- **WHEN** the Admin creates or edits a recurring event with «מילוי עם דירוג» ticked and later assigns the plan
- **THEN** the person's copy carries the option, and the fill form for each occurrence offers the rating select

#### Scenario: Filling with and without a rating

- **WHEN** a manager fills a rated occurrence choosing 4, and another leaving «ללא דירוג»
- **THEN** the first entry shows the scale label pill for 4 and the second shows none — both fills valid

#### Scenario: An unflagged event stays as it was

- **WHEN** a manager fills an occurrence of an event authored without the option
- **THEN** the form offers no rating and the entry stores none
