## ADDED Requirements

### Requirement: An admin can delete a career plan template

The plans list SHALL offer the Admin, and only the Admin, a control that deletes a plan template. The control SHALL NOT appear for other roles, and the deletion SHALL be refused on the server when requested by a non-admin.

Deleting a template SHALL remove the template and the events, metrics, checkpoints and recurrences defined on it. It SHALL NOT be offered for a person's plan copy: a copy belongs to an assignment, and ending the assignment is how a person leaves a plan.

#### Scenario: An admin deletes a template

- **WHEN** the Admin confirms deletion of a plan template
- **THEN** the template and its items are removed and it no longer appears in the plans list or as a choice when assigning a plan

#### Scenario: A manager cannot delete

- **WHEN** a user who is not the Admin views the plans list
- **THEN** no delete control is offered for any plan

#### Scenario: Copies are not offered for deletion

- **WHEN** the plans list is displayed
- **THEN** only templates are listed, and no control deletes a person's own plan copy

### Requirement: Deleting a template does not disturb the people assigned to it

A template SHALL be deletable while people are assigned copies of it. Those people SHALL keep their plan copy, their recorded progress and their gap status exactly as they were: what they are measured against is their own copy, and the template is only what that copy was made from.

The name of the plan SHALL remain readable everywhere it is shown, including in the plan history of people who left it, because the name is recorded on the assignment when it is made and does not depend on the template surviving.

#### Scenario: Deleting a template that people are on

- **WHEN** the Admin deletes a template that people currently hold copies of
- **THEN** those people keep their plan, their progress and their gap status, and nothing about their record changes

#### Scenario: The plan name in the people list

- **WHEN** the people list is shown after the template was deleted
- **THEN** each affected person still shows the name of their plan, without a link, rather than appearing to have no plan

#### Scenario: The plan name in a person's history

- **WHEN** a person's card shows a plan they were previously assigned whose template has since been deleted
- **THEN** the plan is still named in their history

### Requirement: A template deletion is confirmed with its consequence stated

The Admin SHALL be shown, before confirming, how many items the template defines and how many people currently hold a copy of it — counted across the whole system, not clipped to what the Admin manages. The confirmation SHALL state explicitly that those people are not affected apart from losing the link from their plan name to the template.

#### Scenario: Opening the confirmation for a template in use

- **WHEN** the Admin chooses to delete a template that people are assigned
- **THEN** the confirmation names the template, states how many people hold a copy, and states that their plans and progress are unaffected

#### Scenario: A template nobody is on

- **WHEN** the Admin chooses to delete a template with no copies
- **THEN** the confirmation says so rather than showing a warning about people who do not exist

#### Scenario: Declining

- **WHEN** the Admin closes the confirmation without confirming
- **THEN** nothing is deleted
