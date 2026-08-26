# people-registry

## Purpose

מרשם אנשים: כרטיס בסכימה ניתנת-להגדרה, עוגן תאריך-גיוס, שיוך תכנית כעותק עצמאי, ורישום התקדמות.

## Requirements

### Requirement: Configurable person-card field schema

The set of personal-detail fields on a person's card SHALL be a schema defined by the Admin (מנהלן), not a fixed form. This schema also defines the "required fields" that agent-assisted PDF ingestion attempts to extract. Recruitment date SHALL always be part of the schema as the person's service history; it is not what plan offsets resolve through — the unit placement date is the plan anchor.

Where the schema page tells the Admin which fields are fixed and therefore not theirs to define, that list SHALL match the fields the person form actually renders, and SHALL be stated once so the page cannot present two different lists. A field the Admin is told is fixed but is not shown, or is shown but not named, misinforms the only decision the page exists to support: what still needs adding.

A field of type DATE SHALL be entered and displayed under the same Israeli date rules as every other date in the system.

#### Scenario: Admin defines the card schema

- **WHEN** the Admin defines the person-card fields (e.g. name, ID, recruitment date, education, specialty)
- **THEN** those fields become the structure of every person's card and the target field set for ingestion

#### Scenario: Recruitment date is mandatory in the schema

- **WHEN** the Admin configures the person-card schema
- **THEN** the schema SHALL always include recruitment date as service history, while plan offsets continue to resolve through the unit placement date alone

#### Scenario: The fixed fields are named accurately

- **WHEN** the Admin opens the card-schema page
- **THEN** the fixed core fields are named as the person form renders them — first name and last name separately, date of birth, recruitment date, employment status and end-of-service date — together with the placement, photo and career plan that every person carries

#### Scenario: The page states the fixed fields once

- **WHEN** the card-schema page names the fixed fields in more than one place
- **THEN** every occurrence derives from the same list and they cannot disagree

#### Scenario: A custom date field

- **WHEN** a person's custom field of type DATE is filled in
- **THEN** it is entered as `dd/mm/yyyy` and read day-first, like every other date

### Requirement: Person record and personal details

The system SHALL store a person record whose personal-detail fields follow the Admin-defined card schema, and which always includes: **first name and last name as separate fields**, **date of birth**, recruitment date, **unit placement date**, employment status (active / planned-end-date / departed), and organizational placement (team, resolving to section/domain/center). The **unit placement date** SHALL act as the anchor that converts a plan's relative offsets into calendar dates for that person. Date of birth SHALL be required when creating a person; **age SHALL be derived from it and displayed in years and months**, never stored and never manually editable.

The end-of-service field SHALL be named with the term the organisation uses — תאריך סיום שירות (תת״ש) — in the person form and in the field set offered to document extraction, so that a document using that term is matched.

#### Scenario: Creating a person

- **WHEN** a Manager with establishment authority creates a person with first name, last name, date of birth, recruitment date, unit placement date and team placement
- **THEN** the system SHALL store the record and resolve their org path from the team

#### Scenario: Age is derived

- **WHEN** a person's date of birth is known
- **THEN** the card shows their age in years and months, computed from today, with no way to edit it directly

#### Scenario: Birth date required on new records

- **WHEN** a Manager submits a new person without a date of birth
- **THEN** the system SHALL reject the submission

#### Scenario: Placement date anchors the plan

- **WHEN** a person placed in the unit on 2026-03-01 is assigned a plan containing an event at +9 months
- **THEN** the system SHALL compute that event's calendar date as 2026-12-01, regardless of when they were recruited

#### Scenario: A document naming תת״ש

- **WHEN** a document is extracted that gives an end-of-service date under the term תת״ש
- **THEN** the field is recognised and proposed like any other

### Requirement: Employment status governs recurrence

The system SHALL use the person's employment status and end-of-service to bound recurring-event unrolling and to determine whether the person is active for gap reporting.

#### Scenario: End of service stops recurrence

- **WHEN** a person's end-of-service date is set
- **THEN** recurring-event occurrences SHALL not be generated beyond that date

### Requirement: Plan assignment as a template copy

When a plan is assigned to a person, the system SHALL assign a **copy** of the template so that later edits to the template do not retroactively alter the person's assigned plan. A person SHALL have at most one active assignment at a time, and every assignment they have ever had SHALL be retained as a record of the period it covered.

#### Scenario: Assigning a plan

- **WHEN** a manager assigns template plan A to a person
- **THEN** the person receives an independent copy, and subsequent edits to template A do not change the person's plan

#### Scenario: One active plan

- **WHEN** a person is assigned a new plan while they already have one
- **THEN** the earlier assignment is ended rather than removed, and only the new one is active

### Requirement: Recording actual progress

The system SHALL let a manager record a person's actual progress against their assigned plan: marking point events done (with a date), and recording the current value of cumulative metrics (with an as-of date).

#### Scenario: Marking a point event done

- **WHEN** a manager marks "finish basic training" as done for a person
- **THEN** the system SHALL store the completion and its date

#### Scenario: Recording a metric value

- **WHEN** a manager records 247 grant-hours for a person as of a given date
- **THEN** the system SHALL store the actual accumulated value for comparison against plan targets

### Requirement: Enlarging a person's photo

Clicking a person's profile photo SHALL open it enlarged in a centered overlay above the page, dismissible by the user.

#### Scenario: Viewing a photo

- **WHEN** a user clicks the photo on a person's card
- **THEN** the photo is shown enlarged and centered over the page, and can be closed to return to the card

### Requirement: Replacing a person's photo takes effect immediately

When a person's profile photo is uploaded or replaced, the new image SHALL be displayed everywhere that person's photo appears — their card and the people list — without the user reloading, clearing the browser cache, or waiting for a cache window to expire. A previously displayed image SHALL NOT be shown once it has been replaced.

#### Scenario: Replacing an existing photo

- **WHEN** an edit-level Manager uploads a new photo for a person who already has one
- **THEN** the person's card shows the new photo immediately after the upload completes

#### Scenario: The list reflects the change too

- **WHEN** the photo has been replaced
- **THEN** the person's avatar in the people list shows the new photo, not the previous one

#### Scenario: Reloading never shows the old image

- **WHEN** the user reloads any page showing that person after the replacement
- **THEN** the new photo is displayed, with no dependence on a hard refresh or on elapsed time

### Requirement: A replaced photo file is not retained

Uploading a replacement photo SHALL remove the file it replaced from storage, so repeated replacements do not accumulate unreferenced files on the uploads volume. Failure to remove the old file SHALL NOT fail the upload.

#### Scenario: Replacing a photo several times

- **WHEN** a person's photo is replaced repeatedly
- **THEN** only the current photo remains in storage for that person

#### Scenario: Removal fails

- **WHEN** the previous file cannot be deleted
- **THEN** the upload still succeeds and the new photo is the one displayed

### Requirement: A person's plan history is visible on their card

A person's card SHALL show the plans they have been assigned over time — for each, the period it covered, the reason recorded for leaving it, and what was achieved and left unmet during it. Waived items of the active plan SHALL be shown and marked rather than hidden, so that an item not counted as a gap can be told apart from one that is simply absent.

#### Scenario: Viewing a person who has transferred

- **WHEN** a Manager opens the card of a person who has moved between plans
- **THEN** the previous plans are listed with their periods, and each shows what was completed and what was left unmet

#### Scenario: A waived item is visible

- **WHEN** the active plan contains an item waived because it predates the assignment
- **THEN** the item is displayed with a mark identifying it as waived, not omitted from the plan

### Requirement: The people list shows each person's career plan

The people list SHALL show the career plan each person is currently assigned, or a plain indication when they have none. The plan SHALL link to the **template** it was copied from, not to the person's own copy, since the copy is reachable from their card and what a list conveys is which track they are on.

#### Scenario: Opening the plan from the list

- **WHEN** a user clicks the career plan shown for a person
- **THEN** the plan template opens, showing the generic track rather than that person's copy

#### Scenario: A person with no plan

- **WHEN** a person has no active plan assignment
- **THEN** the list shows "ללא מסלול" without a link — wording chosen to differ from the framework column's "ללא שיוך", so two adjacent columns cannot read identically while meaning different things

#### Scenario: The template no longer exists

- **WHEN** a person's plan copy was created from a template that has since been deleted
- **THEN** the plan's name is still shown, without a link, rather than the row appearing to have no plan

### Requirement: Every column of the people list can be filtered

Each column of the people list SHALL be filterable, and the table SHALL narrow as the user types, without reloading the page. Columns holding open text — name, framework, recruitment date — SHALL match on a substring; columns holding a closed set — employment status, career plan — SHALL offer the values actually present, so a filter cannot be misspelled. Filters SHALL combine, and SHALL be clearable in one action.

#### Scenario: Filtering as you type

- **WHEN** a user types into a column's filter
- **THEN** the table narrows immediately, with no page reload

#### Scenario: Combining filters

- **WHEN** filters are set on more than one column
- **THEN** only people matching all of them are listed

#### Scenario: Filtering by a closed set

- **WHEN** a user filters by employment status or by career plan
- **THEN** they choose from the values present in their own view, rather than typing a value

#### Scenario: The count reflects the filtering

- **WHEN** any filter is active
- **THEN** the page states how many people are shown out of how many are visible to that user, and offers to clear the filters

#### Scenario: Filtering cannot widen visibility

- **WHEN** any combination of filters is applied
- **THEN** the result is a subset of the people that user was already permitted to see

### Requirement: Enrolling and removing a person are section-level acts

Creating a person SHALL require establishment authority over the team they are being placed on, and deleting a person SHALL require it over their team. Correcting an existing person's details SHALL NOT — it requires only edit rights over their team, which the commander closest to them holds.

A person belonging to no team SHALL be removable by the Admin alone, there being no framework above them from which authority could derive.

The controls for these acts SHALL be shown to a user exactly when that user may perform them.

#### Scenario: A team commander corrects details but does not enrol

- **WHEN** a Manager whose edit grant sits on a team opens a person on that team
- **THEN** they may change that person's details, and are offered no control to add a person or to delete one

#### Scenario: A section commander does both

- **WHEN** a Manager holding edit on a section opens the people list
- **THEN** they are offered the control to enrol a new person, and the control to delete a person beneath their section

#### Scenario: The form offers only teams the user may enrol into

- **WHEN** a Manager opens the new-person form
- **THEN** the team choices are exactly the teams over which they hold establishment authority

#### Scenario: An unassigned person is the Admin's alone

- **WHEN** a person has no team and a Manager attempts to delete them
- **THEN** the system SHALL refuse, and the Admin SHALL still be able to

#### Scenario: The refusal holds regardless of what was displayed

- **WHEN** a create or delete request arrives for a framework the sender lacks authority over
- **THEN** the system SHALL refuse it on the server, whatever the interface offered

### Requirement: Deleting a person from the people list

The people list SHALL offer a control that deletes a person to the users who hold establishment authority over that person's framework — a commander with edit rights granted at section level or above, and the Admin. The control SHALL NOT appear for anyone else, and the deletion SHALL be refused on the server when requested by a user without that authority, so that hiding the control is presentation and not the protection itself.

Because the authority follows each person's own framework, the control SHALL be decided per person and not per viewer: a commander may see it on one row and not on another.

Deletion SHALL be distinct from departure. A person who has left service is recorded through their employment status and keeps their record; deleting a person is for a record that should not exist.

#### Scenario: A section commander deletes a person

- **WHEN** a commander with establishment authority confirms deletion of a person beneath them
- **THEN** the person disappears from the people list, from the gap dashboard and from every framework they were counted under

#### Scenario: A team commander cannot delete

- **WHEN** a Manager whose edit grant sits on a team views the people list
- **THEN** no delete control is offered for any person, including those on their own team

#### Scenario: An unauthorized deletion submitted directly

- **WHEN** a request to delete a person arrives from a user without establishment authority over that person's framework
- **THEN** the request is refused and the person remains in the system

### Requirement: Deleting a person leaves nothing behind

Deleting a person SHALL remove every record that exists only because that person existed: their plan assignments and the waivers and carry-overs recorded against them, the milestones and readings recorded for them, their evaluations and the attachments of those evaluations, their custom field values, and their agent history.

It SHALL also remove the per-person plan copies made for them. A copy holds no reference back to its person, so nothing removes it automatically; a deletion that left it would leave a plan in the database belonging to nobody, with its own events, targets and recurrences.

Their uploaded files SHALL be removed from storage. Failure to remove the files SHALL NOT undo a deletion that has already been committed, since the database is the source of truth and an unreferenced file is unreachable through the application.

#### Scenario: A person who has transferred between plans

- **WHEN** the Admin deletes a person who has been assigned more than one plan over time
- **THEN** every plan copy made for them is deleted along with its events, targets and recurrences, and no plan copy without an owner remains in the database

#### Scenario: Files are removed

- **WHEN** a person with a profile photo and evaluation attachments is deleted
- **THEN** their uploads directory is removed from storage

#### Scenario: File removal fails

- **WHEN** the person's records are deleted but their files cannot be removed from storage
- **THEN** the deletion still stands and the person does not reappear

#### Scenario: The deletion is all-or-nothing

- **WHEN** any part of the database deletion fails
- **THEN** nothing is deleted and the person is left exactly as they were

### Requirement: A person deletion is confirmed against the real record

The Admin SHALL be shown, before confirming, what the deletion will actually destroy — counted from the database for that person, not estimated and not phrased generically. The confirmation SHALL name the person, and the counts SHALL be present the moment it opens, so the Admin is never asked to approve an unquantified deletion and never waits to find out what one costs.

The counts SHALL convey severity rather than completeness. Records that exist for every person as a matter of course — the fields of their card — SHALL NOT be counted separately from the person, since they are destroyed the way a name or a photo is and listing them puts the largest and least meaningful number in front of the Admin. A count of zero SHALL NOT be listed, and a person with no history at all SHALL be described as such rather than shown a column of zeroes.

#### Scenario: Opening the confirmation

- **WHEN** the Admin chooses to delete a person who has history
- **THEN** a confirmation names that person and states, without waiting, how many plan assignments, evaluations, attachments, recorded milestones and readings will be destroyed, and whether a photo will be removed

#### Scenario: A person with no history

- **WHEN** the Admin chooses to delete a person who has no assignments, evaluations, milestones, readings or files
- **THEN** the confirmation states that only the person's own record will be destroyed, rather than listing counts of zero

#### Scenario: Card fields are not itemised

- **WHEN** any deletion confirmation is shown
- **THEN** the person's custom card-field values are not presented as a separate count

#### Scenario: Declining

- **WHEN** the Admin closes the confirmation without confirming
- **THEN** nothing is deleted

### Requirement: Unit placement date

The system SHALL store, for every person, the date they were placed in this unit (תאריך הצבה ביחידה), required alongside the recruitment date. This date SHALL be the origin of the person's career-plan timeline; the recruitment date SHALL remain part of the record as their history, and SHALL NOT anchor plan offsets.

A person whose placement date is not known SHALL be given their recruitment date, which is the assumption the system made implicitly before the field existed. Both dates SHALL be visible on the person's card, so that a plan date differing from what the recruitment date would imply has a visible cause.

#### Scenario: Creating a person

- **WHEN** a Manager creates a person
- **THEN** a unit placement date is required, and the plan timeline for that person is measured from it

#### Scenario: Existing people when the field is introduced

- **WHEN** the placement date is introduced to a registry of people who have none
- **THEN** each receives their recruitment date, and every computed plan date and gap stays exactly as it was

#### Scenario: Someone who arrived after serving elsewhere

- **WHEN** a person recruited three years ago was placed in this unit one year ago
- **THEN** their plan's month offsets resolve from the placement date, so an event at +12 months falls one year after they arrived, not two years before

#### Scenario: Both dates are shown

- **WHEN** a person's placement date differs from their recruitment date
- **THEN** the person's card shows both, rather than presenting one date as if it explained the plan's schedule

### Requirement: Dates are written and read as Israeli dates

Every date the user types SHALL be entered as `dd/mm/yyyy`, and the system SHALL interpret a numeric date **only** as day-first. The month-first (American) reading SHALL NOT be applied anywhere — not as a primary reading, not as a fallback when the day-first reading fails, and not for a value where both readings are numerically possible.

The entry format SHALL be the same on every machine, and SHALL NOT depend on the browser's or operating system's locale.

A value that cannot be read as a valid calendar date SHALL be refused. The system SHALL NOT store, propose or display a date it did not parse unambiguously.

Machine-to-machine interfaces — the backup bundle and the data handed to the agent — SHALL continue to use ISO `yyyy-mm-dd`, which has no reading to get wrong.

#### Scenario: Entering a date

- **WHEN** a user types `03/08/2026` into any date field
- **THEN** the date is stored as 3 August 2026, never as 8 March

#### Scenario: The same on every machine

- **WHEN** the application is opened on a machine whose locale is US English
- **THEN** date fields still show and accept `dd/mm/yyyy`

#### Scenario: Choosing from a calendar

- **WHEN** a user picks a date from the calendar rather than typing it
- **THEN** the field shows the chosen date as `dd/mm/yyyy`, and that is what is submitted — the calendar writes into the field and is never itself the value

#### Scenario: An impossible date

- **WHEN** a user enters `31/02/2026`
- **THEN** it is refused rather than rolled forward into March

#### Scenario: A malformed date is not stored

- **WHEN** a date that cannot be parsed reaches a server action
- **THEN** the action refuses it rather than storing a guess

#### Scenario: Backups stay machine-readable

- **WHEN** a backup bundle is exported
- **THEN** its dates are ISO, so re-importing them cannot depend on a reading convention

### Requirement: The people list stays one screen tall

The people list SHALL NOT grow the page without bound. Its rows SHALL scroll within a bounded area, keeping the column headers and the filter row in view while the body scrolls, and SHALL render at most a fixed number of rows at a time — with a control revealing more, and a statement of how many of the matching people are currently shown.

Filtering SHALL continue to run over every person the user may see, never over the rendered subset alone: a match beyond the ceiling SHALL be found. Changing a filter SHALL reset the ceiling, so a narrowed result is shown from its beginning.

#### Scenario: A large registry does not produce an endless page

- **WHEN** a user opens the people list holding a thousand people
- **THEN** the page is about one screen tall, the rows scroll within their own area, and the headers and filters stay visible

#### Scenario: Revealing more rows

- **WHEN** more people match than are currently rendered
- **THEN** the list states how many of how many are shown and offers a control that reveals more

#### Scenario: A filter reaches beyond what is rendered

- **WHEN** a user filters for a person whose row is past the current ceiling
- **THEN** that person is found and shown, the ceiling having been reset by the filter change

### Requirement: Exporting the registry to Excel

The people page SHALL offer an export of the registry as an `.xlsx` workbook. Before generating, the user SHALL choose which of the person card's values become columns — offered as the fixed core fields together with every Admin-defined card field, **all selected by default** — and SHALL be able to select or clear them all at once.

The export SHALL cover **every person the requesting user may see, regardless of any filter applied to the table on screen**, and the dialog SHALL state this so the difference is never discovered after the fact. The server SHALL determine that set from the requester's own visibility rather than from anything the request carries, so an export can never reveal a person the requester could not already open. Rows SHALL follow the same order the list uses; dates SHALL be written as Israeli dates; a value a person does not have SHALL be written as an empty cell. The export SHALL be recorded in the activity log.

#### Scenario: Exporting the whole visible registry

- **WHEN** a commander exports with the default selection while a filter narrows the table on screen
- **THEN** the workbook holds every person in their scope — not the filtered subset — one row each, with a header row of all card fields

#### Scenario: Choosing the columns

- **WHEN** the user clears some fields and exports
- **THEN** the workbook carries only the chosen columns, in the order the dialog presents them

#### Scenario: An export cannot widen visibility

- **WHEN** a Manager exports the registry
- **THEN** the workbook contains only people within their own visibility, whatever the request asked for

#### Scenario: Empty values stay empty

- **WHEN** an exported person has no value for a chosen field
- **THEN** that cell is empty in the workbook, rather than carrying a placeholder meant for the screen

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
