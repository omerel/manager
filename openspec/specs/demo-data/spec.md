# demo-data

## Purpose

אכלוס נתוני הדגמה: סקריפט מוסיף (לא הרסני) שבונה ארגון מייצג — אנשים, מסגרות, תכניות והתקדמות — לצורך הערכת המערכת והדגמתה, בפיזור מכוון של מצבי פער ובאופן שחזורי.

## Requirements

### Requirement: Additive demo-dataset generation

The project SHALL provide a command that populates the database with a representative organisation for evaluation and demonstration. It SHALL only insert: no record that existed before the run is modified or removed. It SHALL create at least 30 people and at least 3 career-plan templates.

#### Scenario: Populating an existing system

- **WHEN** an operator runs the generator on a database that already holds people, plans and manually uploaded photos
- **THEN** the generated organisation is added and every pre-existing record, including photos, remains exactly as it was

#### Scenario: Scale

- **WHEN** the generator completes
- **THEN** the database holds at least 30 additional people and at least 3 additional career-plan templates

#### Scenario: Running it a second time

- **WHEN** the generator is run again while its previous output is still present
- **THEN** it SHALL stop without writing anything and explain how to remove the previous dataset, rather than duplicating it or silently doing nothing

### Requirement: The generated data is reproducible

Two runs of the generator against equivalent starting states SHALL produce the same people, the same assignments and the same recorded progress, so that a defect observed in generated data can be reproduced after the database is reset.

#### Scenario: Reproducing a defect

- **WHEN** the database is reset and the generator is run again
- **THEN** the same person exists with the same name, recruitment date, plan and progress as before

### Requirement: The dataset exercises the whole range of system states

Generated people SHALL span the states the system is meant to distinguish, rather than being uniform: a spread of gap states across 🟢 / 🟡 / 🔴, people with no assigned plan, people who have left with an end-of-service date, and **people who have transferred between plans — with a retained previous assignment, waived items on the current one, and at least one carried-over metric or milestone**. Career plans SHALL differ in shape — one led by point events, one by cumulative metrics, one by recurring evaluations — and in horizon.

#### Scenario: The dashboard is not monochrome

- **WHEN** an Admin opens the gap dashboard after generation
- **THEN** the rollup shows people in more than one gap state, and frameworks that differ from one another in their counts

#### Scenario: Unplanned and departed people are present

- **WHEN** the generated people are listed
- **THEN** some have no career plan assigned, and some have an end-of-service date

#### Scenario: Transferred people are present

- **WHEN** the generated people are listed
- **THEN** some have an ended plan assignment alongside their active one, with waived items and at least one carried-over value, so the transfer feature has data to exercise it

#### Scenario: Plans differ in kind

- **WHEN** the generated career plans are opened
- **THEN** each presents a different mix of point events, cumulative metrics and recurring events, and their diagrams differ in the number of event months they span

### Requirement: Card values follow the Admin-defined schema

The generator SHALL read the person-card field definitions and produce a value appropriate to each field's type, including choosing from an enum field's own options. It SHALL NOT rely on a fixed list of fields.

#### Scenario: A field is added before generating

- **WHEN** the Admin adds a new field to the person card and the generator is then run
- **THEN** generated people carry a plausible value for that field too

#### Scenario: Enum values are valid

- **WHEN** a card field is a closed list
- **THEN** every generated value for it is one of that field's defined options

### Requirement: Generated data is contained under one framework

All generated people SHALL be attached to teams within a single dedicated top-level framework, so the dataset can later be removed by deleting that framework rather than by identifying records individually.

#### Scenario: Locating the dataset

- **WHEN** an Admin views the hierarchy after generation
- **THEN** the generated organisation appears as one center, with every generated person somewhere beneath it

#### Scenario: Removing it later

- **WHEN** that center is deleted through the confirmed cascade delete
- **THEN** the generated frameworks are removed and the generated people become unassigned
