## 1. Session core

- [x] 1.1 Implement signed-session helpers (create/verify HMAC cookie, 7-day expiry) using APP_SECRET
- [x] 1.2 Rewrite `getSessionUser`: verify session, redirect to /login when invalid; add non-redirecting variant for data routes; delete the admin fallback
- [x] 1.3 Return 401/404 from file/photo/download routes when unauthenticated

## 2. Login & logout

- [x] 2.1 Build /login page (username-or-email + password, RTL, generic error message)
- [x] 2.2 Login action: lookup by username/email, scrypt verify, set session, redirect to dashboard
- [x] 2.3 Logout action + header button (clear cookie → /login)
- [x] 2.4 Gate /switch and the header switcher behind DEV_USER_SWITCH=1 (inert otherwise)

## 3. Password management

- [x] 3.1 Account page: change my password (current + new, verified)
- [x] 3.2 Admin password reset on /access (set new password without the old one)

## 4. Verification & docs

- [x] 4.1 Browser-test: login success/failure, protected-page redirect, tampered/expired cookie rejection, logout
- [x] 4.2 Verify data routes deny unauthenticated access; switcher inert without the flag
- [x] 4.3 Update web/README.md (sign-in step, seeded credentials, DEV_USER_SWITCH)
