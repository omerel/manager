## ADDED Requirements

### Requirement: Editing existing plan events

The Admin SHALL be able to edit any event already defined in a plan: a point event's label and offset; a cumulative metric's name and unit, and each of its checkpoints' target and offset; and a recurring event's label, interval, and stop condition. Recorded person progress SHALL survive an edit of the event it belongs to.

#### Scenario: Editing a point event

- **WHEN** the Admin changes a point event's label or offset
- **THEN** the plan reflects the change, and people who already completed that event keep their completion

#### Scenario: Editing a metric and its checkpoints

- **WHEN** the Admin changes a metric's unit or a checkpoint's target
- **THEN** the plan reflects the change and recorded metric values are preserved

#### Scenario: Editing a recurring event

- **WHEN** the Admin changes a recurring event's interval or stop condition
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
