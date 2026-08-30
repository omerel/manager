# career-plans — delta

## ADDED Requirements

### Requirement: A plan item may carry a format or guidance file

A point event and a recurring event in a career plan MAY carry one attached file, authored under «פורמטים והנחיות» by the Admin in the plan editor — the format to be filled in, or the guidance for the event. A cumulative metric SHALL NOT take one. Uploading a file where one already exists SHALL replace it, and the replaced file SHALL NOT be retained.

Where a person is assigned a plan, the file SHALL be offered for download at that event on their card — at **every occurrence** of a recurring event, each occurrence needing the same form. The file offered SHALL be the one the template carries **at the moment it is asked for**, not one captured when the person was assigned: a guideline is the document that applies now. An event with no file offers nothing, and a personal event — belonging to no template item — never carries one.

Deleting a plan item SHALL delete its file. A person assigned before this capability existed carries no link to their template items and SHALL therefore be offered nothing, rather than being offered a guess.

#### Scenario: Authoring a guideline

- **WHEN** the Admin attaches «טופס-הגשה.docx» to a point event in a template
- **THEN** everyone assigned that plan is offered that file for download at that event on their card

#### Scenario: The guideline stays current

- **WHEN** the Admin replaces the attached file with a newer version
- **THEN** already-assigned people are offered the new file, and the replaced one is not retained

#### Scenario: A recurring event's file repeats

- **WHEN** a recurring event carries a file
- **THEN** each of its occurrences on a person's card offers that same file

#### Scenario: Removing the item removes the file

- **WHEN** the Admin deletes a plan item that carries a file
- **THEN** the file is deleted and no longer offered anywhere

#### Scenario: Nothing to offer

- **WHEN** an event carries no file, or is a personal event, or belongs to a copy made before this capability
- **THEN** no download is offered at it
