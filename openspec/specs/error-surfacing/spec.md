# error-surfacing

## Purpose

User-facing failure handling: a refused action reports its reason to the user in place — never as a dead page, and never redacted away by a production build.

## Requirements

### Requirement: A refused action reports its reason in place

When a user-submitted action is refused — invalid input, a business rule, a conflict — the system SHALL keep the user on the page with their input intact and SHALL present the refusal's reason as a dismissible toast notification. The reason SHALL be the same message the rule states, in Hebrew, in production builds as in development.

#### Scenario: Invalid input pops a toast, not an error page

- **WHEN** a user submits a form the server refuses (for example, a query whose due date has already passed)
- **THEN** the page remains as it was, the typed input is preserved, and a red toast appears stating the refusal's reason, dismissible by hand and auto-dismissing after a few seconds

#### Scenario: A successful action behaves as before

- **WHEN** a user submits a form the server accepts
- **THEN** the action completes exactly as today — including redirect-after-success where the action performs one — and no toast appears

### Requirement: The generic error page is a last resort

The system SHALL have a global error boundary offering recovery (return home, retry). It SHALL NOT be reached by ordinary refusals of user actions — those surface as toasts — and it makes no claim to show failure reasons.

#### Scenario: An unforeseen failure still leaves an exit

- **WHEN** an error outside the action-refusal path escapes to the boundary
- **THEN** the user sees a branded recovery page with a way back, rather than the platform's default error screen
