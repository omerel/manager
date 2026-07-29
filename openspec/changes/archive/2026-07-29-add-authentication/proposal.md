## Why

The access *model* (Admin/Manager roles, node+level grants, scoped visibility) is fully built and enforced, but the way a user *becomes* the active user is still the development stand-in: a header dropdown that sets a plain `uid` cookie via `/switch`. Anyone who can reach the app can impersonate anyone — including the admin. This was task 0.2, deliberately deferred from the original career-management-system change; it is the last open item blocking real multi-user use.

The groundwork already exists: every user has a `username` (derived from their email prefix) and a scrypt `passwordHash` stored at creation, and the server holds an `APP_SECRET` for cryptographic signing.

## What Changes

- **Login page** (`/login`) — sign in with username *or* email + password, verified against the stored scrypt hash. Hebrew/RTL like the rest of the app.
- **Real sessions** — an HMAC-signed, HTTP-only session cookie (user id + expiry, signed with `APP_SECRET`); `getSessionUser` validates the signature and expiry instead of trusting a raw `uid`, and **redirects to `/login` when there is no valid session** (no more "fall back to the first admin").
- **Logout** — a header button that clears the session.
- **BREAKING (dev-flow): the user-switcher is removed** from the header. For local development it remains available only when an explicit env flag (`DEV_USER_SWITCH=1`) is set; it is inert otherwise.
- **Password management** — a user can change their own password (current + new); the Admin can reset any user's password from the users page (replacing the old value, e.g. for onboarding/forgot-password).
- **Route protection** — every page and API route (files, photos, downloads) requires a valid session; `/login` is the only public route.

## Capabilities

### New Capabilities
- `authentication`: Sign-in with username/email + password, signed session lifecycle (create/validate/expire/logout), password change & admin reset, and the public/protected route boundary.

### Modified Capabilities
<!-- None: access-control's requirements (roles, grants, visibility, privacy) are unchanged —
     this change replaces only the *mechanics* of establishing who the current user is,
     which the access-control spec never defined. -->

## Impact

- **Code**: `src/lib/session.ts` (rewrite: signed session + redirect), new `src/lib/auth-actions.ts` + `/login` page, header (logout button, switcher removal), `/switch` route (env-gated), users page (admin password reset), possibly a small `middleware`/guard for route protection. No schema migration expected — `username` and `passwordHash` columns already exist.
- **Behavior**: first visit now lands on `/login`; seeded users sign in with password `password`.
- **Security posture**: eliminates open impersonation; secrets stay server-side (scrypt at rest, HMAC via existing `APP_SECRET`). Full hardening (rate limiting, lockout, password policy, 2FA) is explicitly out of scope for this change.
- **Docs**: `web/README.md` setup flow gains a "sign in" step.
