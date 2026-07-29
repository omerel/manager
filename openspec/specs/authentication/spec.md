# authentication

## Purpose

אימות: התחברות בשם-משתמש/אימייל + סיסמה, session חתום (יצירה/אימות/פקיעה/יציאה), ניהול סיסמאות (עצמי + איפוס אדמין), וגבול הציבורי/מוגן של המסלולים.

## Requirements

### Requirement: Sign in with username or email and password

The system SHALL present a login page where a user signs in with their username **or** email plus password. The password SHALL be verified against the stored scrypt hash; on success a session is established and the user lands on the dashboard.

#### Scenario: Successful login

- **WHEN** a user submits a valid username (or email) and the matching password
- **THEN** a session is created and the user is redirected to the dashboard, scoped by their role and grants

#### Scenario: Failed login

- **WHEN** a user submits a wrong password or an unknown identifier
- **THEN** the system SHALL show a generic error ("שם משתמש או סיסמה שגויים") without revealing which part was wrong, and no session is created

#### Scenario: User without a password cannot sign in

- **WHEN** a user record has no stored password hash
- **THEN** login for that user SHALL fail until the Admin sets a password

### Requirement: Signed session lifecycle

A session SHALL be an HTTP-only, HMAC-signed cookie carrying the user id and an expiry, signed with the server-side secret. The server SHALL reject sessions with an invalid signature or past expiry. Sessions SHALL expire after a bounded period (days, not months).

#### Scenario: Tampered cookie is rejected

- **WHEN** a request carries a session cookie whose payload or signature was altered
- **THEN** the session is treated as absent and the user is redirected to login

#### Scenario: Expired session

- **WHEN** a request carries a session past its expiry
- **THEN** the user is redirected to login

### Requirement: Protected routes; login is the only public page

Every page and data route (including file, photo, and report downloads) SHALL require a valid session. An unauthenticated request to any protected page SHALL redirect to `/login`; data routes SHALL return an unauthenticated status instead of content. The login page itself is public.

#### Scenario: Unauthenticated page visit

- **WHEN** a visitor without a session opens any app page
- **THEN** they are redirected to `/login`

#### Scenario: Unauthenticated data route

- **WHEN** a request without a session hits a file/photo/download route
- **THEN** the response is 401/404 and no content is served

#### Scenario: No silent fallback user

- **WHEN** no valid session exists
- **THEN** the system SHALL NOT fall back to any default user (the previous dev behavior)

### Requirement: Logout

The system SHALL provide a logout control in the header that clears the session and returns the user to the login page.

#### Scenario: Logging out

- **WHEN** a signed-in user clicks logout
- **THEN** the session cookie is cleared and they are redirected to `/login`

### Requirement: Password change and admin reset

A signed-in user SHALL be able to change their own password by providing the current password and a new one. The Admin SHALL be able to set/reset any user's password from the users page (without knowing the old one), covering onboarding and forgotten passwords.

#### Scenario: Self change with wrong current password

- **WHEN** a user submits a password change with an incorrect current password
- **THEN** the change is rejected

#### Scenario: Admin resets a password

- **WHEN** the Admin sets a new password for a user
- **THEN** the user's old password stops working and the new one works immediately

### Requirement: Dev user-switcher is disabled by default

The development user-switcher (`/switch` and its header control) SHALL be inert unless an explicit development environment flag is set. With the flag unset, `/switch` SHALL not change the session.

#### Scenario: Switcher off in normal operation

- **WHEN** the dev flag is not set and a request hits `/switch`
- **THEN** no session change occurs

#### Scenario: Switcher available for local development

- **WHEN** the dev flag is explicitly set
- **THEN** the switcher behaves as before, for local testing only
