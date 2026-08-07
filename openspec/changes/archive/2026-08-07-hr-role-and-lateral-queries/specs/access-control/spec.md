## RENAMED Requirements

- FROM: `### Requirement: Two roles; the tracked person is never a user`
- TO: `### Requirement: Three roles; the tracked person is never a user`

## MODIFIED Requirements

### Requirement: Three roles; the tracked person is never a user

The system SHALL define exactly three user roles — **Admin** (מנהלן, who is also the אדמין), **Manager** (מנהל) and **HR** (משא״ן) — and SHALL NOT treat a tracked person (איש) as a user. A tracked person never authenticates and exists purely as data.

HR SHALL be operational rather than configurational: what an HR user sees and may change follows from their access grants exactly as it does for a Manager, and the Admin SHALL remain the sole authority for users, grants, plan templates and the person-card schema. HR SHALL NOT confer establishment authority; an HR user enrols or removes a person only under the same rule as anyone else — an edit grant at section level or above.

Every place that names a user's role SHALL read one definition of the labels, so that adding a role cannot leave a screen silently calling it by another role's name.

#### Scenario: Person is not a user

- **WHEN** a person record is created in the registry
- **THEN** no login or user account is created for that person

#### Scenario: Only defined roles can sign in

- **WHEN** someone accesses the system
- **THEN** they act as an Admin, a Manager or an HR user, never as a tracked person

#### Scenario: HR cannot configure

- **WHEN** an HR user attempts to change access grants, plan templates, or the person-card schema
- **THEN** the system SHALL deny the action, exactly as it does for a Manager

#### Scenario: HR does not gain establishment authority from the role

- **WHEN** an HR user whose only edit grant sits on a team attempts to enrol or remove a person
- **THEN** the system SHALL refuse, the rule being the level the grant sits at and not the role

#### Scenario: Every screen names the role correctly

- **WHEN** an HR user's role is displayed anywhere it is shown
- **THEN** it reads משא״ן, and not the label of another role

## ADDED Requirements

### Requirement: The query page belongs to correspondents, not only to commanders

Access to the query page SHALL follow from holding a correspondent identity: commanding a framework, or being an HR user with at least one access grant. A user who is neither SHALL have no access to the page.

An HR user's correspondent identity SHALL be their own, not the framework they are granted over. The commander of that framework SHALL NOT see, act on, or be considered the sender of an HR user's queries.

#### Scenario: An HR user reaches the page

- **WHEN** an HR user with a grant opens the system
- **THEN** the query page is offered to them, though they command nothing

#### Scenario: An HR user with no grant

- **WHEN** an HR user holds no access grant at all
- **THEN** the query page is closed to them, as it is to a Manager who commands nothing

#### Scenario: The commander of the granted framework is not the sender

- **WHEN** an HR user granted over a domain sends a query, and the domain's commander opens their own page
- **THEN** that commander does not see the HR user's query among the queries their framework sent, and cannot close, edit or delete it
