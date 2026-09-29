# guest-access

## Purpose

כניסת אורח: כיצד אדם שנמדד במערכת, ואין לו חשבון, מתקבל לצפייה ברשומה של עצמו בלבד — ומה נאסר עליו שם.

## Requirements

### Requirement: A tracked person may be admitted to view their own record

The system SHALL offer, on the login page, a second way in beside signing in as a user: **guest entry**, for a tracked person who has no account. Guest entry SHALL ask for a date of birth and a תעודת זהות, and nothing else.

The system SHALL admit the visitor only when ALL of the following hold: a תעודת זהות field is defined in the person-card schema; exactly one person in the registry holds that value; that person's recorded date of birth matches the one given; and that person has a career plan assigned. If any one of these fails, the visitor SHALL NOT be admitted.

Guest entry SHALL create no account, confer no role, and confer no access grant. A guest SHALL NOT appear anywhere the system counts or lists users.

#### Scenario: A person with a plan is admitted

- **WHEN** a visitor enters the date of birth and תעודת זהות of a person who has a career plan assigned
- **THEN** they are admitted, and that person's record opens for viewing

#### Scenario: A person without a plan is not admitted

- **WHEN** the details match a person in the registry who has no career plan assigned
- **THEN** they are not admitted

#### Scenario: Guest entry creates nothing

- **WHEN** a guest is admitted
- **THEN** no user account, role or access grant comes into being, and the guest appears in no list or count of users

### Requirement: Every refusal reads the same

Every failure of guest entry SHALL be answered with one identical message, stating that no career plan was found for them. The system SHALL NOT distinguish, in what it shows the visitor, between a תעודת זהות that belongs to nobody, one that belongs to someone whose date of birth does not match, a person carrying no recorded date of birth, a person with no career plan, or a system in which the תעודת זהות field is not defined at all.

The message SHALL NOT name a person, confirm that a person exists, or say which of the two details was wrong.

#### Scenario: Unknown identity

- **WHEN** the תעודת זהות given belongs to nobody in the registry
- **THEN** the visitor is told no career plan was found for them

#### Scenario: Right identity, wrong date of birth

- **WHEN** the תעודת זהות matches a person but the date of birth does not
- **THEN** the visitor sees exactly the same message, word for word, as for an unknown identity — nothing reveals that the identity was recognised

#### Scenario: The feature is not configured

- **WHEN** no תעודת זהות field is defined in the person-card schema
- **THEN** every guest attempt returns that same message, and the visitor learns nothing about the system's configuration

#### Scenario: An identity held by more than one person

- **WHEN** the value given is somehow held by two people in the registry
- **THEN** the visitor is not admitted, and sees the same message — the system SHALL NOT choose between them

### Requirement: A guest sees their own record, and may change nothing

An admitted guest SHALL see their own person record in full, exactly as it stands: their personal details and card fields, their career plan drawn as a vector, the textual lists of plan items with their standing, and the evaluations and interview summaries recorded about them, including the 1–5 assessments. They SHALL be able to export their own career plan as a PDF.

A guest SHALL be offered no control that changes anything — no form, no edit mode, no upload, no delete — and any attempt to invoke one SHALL be refused by the server regardless of what was displayed.

#### Scenario: The record opens for reading

- **WHEN** a guest is admitted
- **THEN** their details, their career plan drawing, their plan item lists and the evaluations written about them are all shown

#### Scenario: Nothing can be changed

- **WHEN** a guest views their record
- **THEN** no edit control, form or upload is offered anywhere on it

#### Scenario: A refused write

- **WHEN** a request that would change data arrives carrying a guest session
- **THEN** the server SHALL refuse it, whatever the interface offered

#### Scenario: The guest exports their plan

- **WHEN** a guest exports their career plan
- **THEN** they receive the PDF of their own plan, in their own status colours

### Requirement: A guest reaches their own record and nothing else

The page a guest is admitted to SHALL take no person identifier from the URL: the person is resolved from the signed guest session alone. There SHALL be no address a guest can type, alter or share that opens another person's record, and this SHALL hold for the plan export exactly as for the page.

A guest session SHALL NOT admit its holder to any other page or data route in the system. Every existing page and route SHALL treat a guest as unauthenticated.

#### Scenario: No identifier to tamper with

- **WHEN** a guest views their record
- **THEN** the address carries no person identifier, so there is nothing in it to change

#### Scenario: A guest at another page

- **WHEN** a guest opens any page of the system other than their own record
- **THEN** they are treated as unauthenticated and sent to the login page

#### Scenario: A guest at a data route

- **WHEN** a guest requests a file, photo or report route belonging to the rest of the system
- **THEN** the response is unauthenticated and no content is served

#### Scenario: A guest session is not a user session

- **WHEN** a guest session token is presented where a user session is expected, or the reverse
- **THEN** it SHALL NOT verify, the two being signed for different purposes

### Requirement: A guest may leave, and their session expires on its own

A guest SHALL be shown, while viewing their record, who they are signed in as, and SHALL be able to sign out. A guest session SHALL expire on its own after a period shorter than a user session, these being shared terminals and a weaker credential.

#### Scenario: Signing out

- **WHEN** a guest signs out
- **THEN** their session ends and the login page is shown again

#### Scenario: The header names the guest

- **WHEN** a guest views their record
- **THEN** the header shows their name and a way to sign out, rather than presenting them as signed out
