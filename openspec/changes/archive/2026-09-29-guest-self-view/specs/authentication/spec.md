## MODIFIED Requirements

### Requirement: Signed session lifecycle

A session SHALL be an HTTP-only, HMAC-signed cookie carrying a subject id and an expiry, signed with the server-side secret. The server SHALL reject sessions with an invalid signature or past expiry. Sessions SHALL expire after a bounded period (days, not months).

There are two kinds of session — a **user** session and a **guest** session — and they SHALL be separated at the signature, not merely by name: the signed payload SHALL state which kind it is, so that a token minted as one kind does not verify as the other even if it is placed in the other's cookie. A guest session SHALL expire sooner than a user session.

#### Scenario: Tampered cookie is rejected

- **WHEN** a request carries a session cookie whose payload or signature was altered
- **THEN** the session is treated as absent and the user is redirected to login

#### Scenario: Expired session

- **WHEN** a request carries a session past its expiry
- **THEN** the user is redirected to login

#### Scenario: A session of the wrong kind

- **WHEN** a valid guest token is presented in the user session cookie, or a valid user token in the guest cookie
- **THEN** it SHALL NOT verify, and the request is treated as having no session at all

### Requirement: Protected routes; login is the only public page

Every page and data route (including file, photo, and report downloads) SHALL require a valid session. An unauthenticated request to any protected page SHALL redirect to `/login`; data routes SHALL return an unauthenticated status instead of content. The login page itself is public.

A guest session SHALL satisfy this requirement for the guest's own record and its plan export ALONE. Everywhere else in the system a guest SHALL be treated exactly as an unauthenticated visitor — pages redirect them to `/login`, data routes refuse them — so that admitting a guest cannot widen what any existing page shows.

#### Scenario: Unauthenticated page visit

- **WHEN** a visitor without a session opens any app page
- **THEN** they are redirected to `/login`

#### Scenario: Unauthenticated data route

- **WHEN** a request without a session hits a file/photo/download route
- **THEN** the response is 401/404 and no content is served

#### Scenario: A guest elsewhere in the system

- **WHEN** a request carrying only a guest session opens a page or data route other than the guest's own record and its plan export
- **THEN** it is treated as unauthenticated — redirected or refused, exactly as a visitor with no session at all

#### Scenario: No silent fallback user

- **WHEN** no valid session exists
- **THEN** the system SHALL NOT fall back to any default user (the previous dev behavior)

### Requirement: Logout

The system SHALL provide a logout control in the header that clears the session and returns the visitor to the login page — for an admitted guest exactly as for a signed-in user.

#### Scenario: Logging out

- **WHEN** a signed-in user clicks logout
- **THEN** the session cookie is cleared and they are redirected to `/login`

#### Scenario: A guest logs out

- **WHEN** an admitted guest signs out
- **THEN** their guest session cookie is cleared and they are redirected to `/login`
