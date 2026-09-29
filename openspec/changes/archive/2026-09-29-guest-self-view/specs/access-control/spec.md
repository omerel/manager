## MODIFIED Requirements

### Requirement: Three roles; the tracked person is never a user

The system SHALL define exactly three user roles — **Admin** (מנהלן, who is also the אדמין), **Manager** (מנהל) and **HR** (משא״ן) — and SHALL NOT treat a tracked person (איש) as a user. A tracked person SHALL have no account, no role and no access grant, SHALL never act in the system, and SHALL never appear where the system counts or lists its users.

A tracked person MAY nonetheless be admitted, through guest entry, to READ the record the system keeps about them — their own and no other. That admission is not a user session and confers nothing beyond reading: it grants no role, creates no grant, enters no visibility computation, and permits no action of any kind. The distinction the system holds is between **being a user** and **being let in to read about oneself**; the first remains closed to a tracked person.

HR SHALL be operational rather than configurational: what an HR user sees and may change follows from their access grants exactly as it does for a Manager, and the Admin SHALL remain the sole authority for users, grants, plan templates and the person-card schema. HR SHALL NOT confer establishment authority; an HR user enrols or removes a person only under the same rule as anyone else — an edit grant at section level or above.

Every place that names a user's role SHALL read one definition of the labels, so that adding a role cannot leave a screen silently calling it by another role's name.

#### Scenario: Person is not a user

- **WHEN** a person record is created in the registry
- **THEN** no login or user account is created for that person

#### Scenario: Only defined roles can sign in

- **WHEN** someone signs in as a user of the system
- **THEN** they do so as an Admin, a Manager or an HR user, never as a tracked person — and whoever performs any action in the system is one of those three

#### Scenario: A guest is not a user

- **WHEN** a tracked person is admitted through guest entry
- **THEN** they hold no role and no grant, are counted in no list of users, and can perform no action — they may only read their own record

#### Scenario: HR cannot configure

- **WHEN** an HR user attempts to change access grants, plan templates, or the person-card schema
- **THEN** the system SHALL deny the action, exactly as it does for a Manager

#### Scenario: HR does not gain establishment authority from the role

- **WHEN** an HR user whose only edit grant sits on a team attempts to enrol or remove a person
- **THEN** the system SHALL refuse, the rule being the level the grant sits at and not the role

#### Scenario: Every screen names the role correctly

- **WHEN** an HR user's role is displayed anywhere it is shown
- **THEN** it reads משא״ן, and not the label of another role
