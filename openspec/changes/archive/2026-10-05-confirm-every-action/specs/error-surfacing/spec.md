## MODIFIED Requirements

### Requirement: A refused action reports its reason in place

When a user-submitted action is refused — invalid input, a business rule, a conflict — the system SHALL keep the user on the page with their input intact and SHALL present the refusal's reason as a dismissible toast notification. The reason SHALL be the same message the rule states, in Hebrew, in production builds as in development.

#### Scenario: Invalid input pops a toast, not an error page

- **WHEN** a user submits a form the server refuses (for example, a query whose due date has already passed)
- **THEN** the page remains as it was, the typed input is preserved, and a red toast appears stating the refusal's reason, dismissible by hand and auto-dismissing after a few seconds

#### Scenario: A successful action behaves as before

- **WHEN** a user submits a form the server accepts
- **THEN** the action completes exactly as today — including redirect-after-success where the action performs one — and the outcome is confirmed as the requirement below describes

## ADDED Requirements

### Requirement: An accepted action confirms that it happened

A user who submits an action SHALL be told that it was carried out. Where a page re-renders into a state indistinguishable from the one before — a field saved with the same text, a box ticked, a value added to a list — silence is indistinguishable from failure, and the honest reading of it is that nothing happened.

Confirmation SHALL be presented the same way a refusal is, in the same place and with the same behaviour, differing in colour and in wording: it SHALL be dismissible by hand and SHALL disappear on its own, in **less** time than a refusal is given, a confirmation being the outcome that needs no reading.

Confirmation SHALL be the DEFAULT for every form that submits an action, not something each form opts into. A form added later SHALL confirm without anyone remembering to ask for it; opting in is the arrangement that produced the silence this requirement removes.

The default wording SHALL be neutral as to what the action did, since the same mechanism carries saves, deletions and dispatches alike, and SHALL be replaceable per form where a precise sentence serves the user better.

A form MAY be exempted explicitly where the outcome is already evident without being stated — a row that vanishes from a list, an action that navigates elsewhere. An exemption SHALL be a decision recorded at that form, never the absence of one.

Confirmation SHALL be announced to assistive technology as a status rather than an alert, so that it is read without interrupting.

#### Scenario: A save that changes nothing visible

- **WHEN** a user saves a form whose result the page cannot show — the same values re-rendered, a setting with no visible effect on that screen
- **THEN** a confirmation appears stating the action was carried out, so that the user is not left reading an unchanged screen

#### Scenario: Confirmation and refusal are the same mechanism

- **WHEN** one submission is accepted and another refused
- **THEN** both are reported in the same place and in the same manner, distinguished by colour and wording, and the confirmation clears sooner than the refusal

#### Scenario: A new form confirms without being asked to

- **WHEN** a form is added that submits an action and says nothing about confirmation
- **THEN** it confirms on success, the behaviour being the default rather than an option

#### Scenario: An action that navigates away

- **WHEN** an accepted action takes the user to another page
- **THEN** the navigation itself is the confirmation, and nothing is shown that the departing page could not display

#### Scenario: A form that states its own outcome

- **WHEN** a form already reports what it did in its own words — naming what was imported, or counting what was removed
- **THEN** that report stands as the confirmation, and no second generic one is added beside it

#### Scenario: Announced, not interrupting

- **WHEN** a confirmation appears for a user relying on a screen reader
- **THEN** it is conveyed as a status update rather than an alert
