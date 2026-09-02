# activity-log — delta

## ADDED Requirements

### Requirement: A successful sign-in is recorded

The system SHALL record every successful sign-in as an activity entry attributed to the user who signed in, and SHALL stamp that moment on the user's record so that dormancy can be judged from a fact that outlives the log's retention. A failed sign-in SHALL NOT be recorded — it is a security signal, not usage.

Recording a sign-in SHALL be the one place an actor is supplied rather than resolved from the session, since at that moment the session does not yet exist; that door SHALL be named and confined to the just-authenticated user, so the rule that no caller may attribute an act to someone else holds everywhere else.

#### Scenario: Signing in leaves a trace

- **WHEN** a user signs in with correct credentials
- **THEN** an entry attributed to them is written, and their record carries the time of it

#### Scenario: A failed attempt leaves none

- **WHEN** a sign-in is refused
- **THEN** no entry is written and no time is stamped

### Requirement: The Admin sees usage as a shape, not only as a list

The system SHALL provide an Admin-only usage dashboard summarising how the system is being used: how many users were active out of the total, how many sign-ins and how many recorded actions occurred, how many users are dormant, activity per day over the chosen window, a breakdown by family of action, and a per-user table showing each user's sign-ins, actions and last activity. Selecting one user SHALL narrow the whole view to them.

The windows offered SHALL be bounded by the log's own retention period, and the page SHALL state that period: a window reaching past what is kept would present deletion as decline. Days SHALL be counted in Israel local time, so that an action taken after midnight belongs to the day it was taken.

The dashboard SHALL be exportable both as a visual report and as a spreadsheet of the underlying figures, each covering exactly the current selection.

#### Scenario: The Admin opens the dashboard

- **WHEN** the Admin opens the usage dashboard
- **THEN** they see the active and dormant counts, sign-ins and actions for the window, activity per day, a breakdown by action family, and a row per user

#### Scenario: Narrowing to one user

- **WHEN** the Admin selects a single user
- **THEN** every figure and chart on the page describes that user alone

#### Scenario: The window cannot outrun the retention

- **WHEN** the log is kept for thirty days
- **THEN** no longer window is offered, and the page states the period it is working within

#### Scenario: A day is an Israeli day

- **WHEN** an action is taken at half past midnight Israel time
- **THEN** it is counted on that day, not on the previous one

#### Scenario: Exporting the report

- **WHEN** the Admin exports the dashboard
- **THEN** they may take a visual report and a spreadsheet, both describing the current window and selection

#### Scenario: Only the Admin

- **WHEN** any other user opens the dashboard's address
- **THEN** they are refused, as they are for the activity log itself
