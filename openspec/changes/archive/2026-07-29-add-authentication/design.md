## Context

The app currently "authenticates" via a dev stand-in: a header dropdown POSTs to `/switch`, which sets a plain `uid` cookie; `getSessionUser` trusts it and even falls back to the first admin when absent. Everything else (roles, grants, visibility clipping, private rules) already keys off `getSessionUser`, which makes this a narrow, well-contained replacement: harden that single seam and the whole app inherits real auth. Users already carry `username` + scrypt `passwordHash` (set at creation by the Admin), and the server already holds `APP_SECRET` (used for at-rest encryption earlier; reusable for HMAC signing).

## Goals / Non-Goals

**Goals:**
- Replace the trust-any-cookie flow with credentialed login and a tamper-proof session.
- Keep the change dependency-free: Node's `crypto` (HMAC + scrypt) and the existing `APP_SECRET`; no auth framework.
- Preserve every existing behavior downstream of `getSessionUser` untouched.
- Keep local development ergonomic (env-gated switcher).

**Non-Goals:**
- Rate limiting, account lockout, password-strength policy, 2FA, email flows (reset links), SSO/OIDC — explicitly deferred.
- Multi-tenancy or remember-me/refresh-token sophistication.

## Decisions

**D1 — Sessions are stateless HMAC-signed cookies, not DB rows.**
Cookie value: `base64(userId.expiresAt).hmacSHA256(payload, APP_SECRET)`, HTTP-only, SameSite=Lax, 7-day expiry. *Why:* zero schema change, zero session-table GC, instant verification in `getSessionUser`; revocation granularity (a DB session table) isn't needed at this stage. *Alternative rejected:* JWT libs / iron-session — add dependencies for no capability we use.

**D2 — `getSessionUser` becomes the single enforcement point.**
It verifies signature+expiry and `redirect("/login")` on failure; the admin-fallback is deleted. Data routes (files/photos/downloads) call a non-redirecting variant that returns null → 401/404. *Why:* every page and action already flows through this function; enforcing here means no per-page guard sprawl and no forgotten routes.

**D3 — Login accepts username or email.**
One identifier field; lookup `OR [{username}, {email}]`; scrypt verify via the existing `verifyPassword`. Generic failure message (no user-enumeration). *Why:* usernames were derived from emails, users will remember either.

**D4 — The switcher survives only behind `DEV_USER_SWITCH=1`.**
`/switch` no-ops and the header hides the control unless the flag is set. *Why:* it is genuinely useful for local role-testing (we used it constantly), but must be inert everywhere else. **BREAKING** for the current dev flow: without the flag you must log in.

**D5 — Passwords: self-change requires the current password; Admin reset does not.**
Self-service lives on a small account page; Admin reset joins the existing create-user form on `/access` (same scrypt path). *Why:* covers forgot-password without email infrastructure, and the Admin already owns user lifecycle.

## Risks / Trade-offs

- **Stateless sessions can't be revoked server-side** (short of rotating `APP_SECRET`, which logs everyone out) → acceptable at 7-day expiry and this trust level; a session table can be added later without spec changes.
- **`APP_SECRET` becomes doubly critical** (at-rest encryption + session signing) → already gitignored; `.env.example` documents generating a strong value.
- **No lockout/rate limit** → noted as deferred; local/intranet deployment assumed for now.
- **Seeded demo passwords ("password")** → fine for dev; README must tell real deployments to change them.
- **Redirect-on-every-page depends on `getSessionUser` being used everywhere** → it is (verified across pages/actions/routes); new code must keep that convention. Noted in README.

## Migration Plan

1. Ship login + session verification with the fallback still present (nothing breaks).
2. Flip `getSessionUser` to redirect (removes fallback) + gate `/switch` behind the flag + header logout.
3. Update README (sign-in step, DEV_USER_SWITCH for local testing).
No DB migration; existing users sign in with their already-stored passwords (seed: `password`).

## Open Questions

- Session duration: 7 days fixed vs. sliding renewal on activity (leaning: fixed 7d now, sliding later).
- Should the account (password-change) page also absorb future per-user settings? (Likely yes, but out of scope.)
