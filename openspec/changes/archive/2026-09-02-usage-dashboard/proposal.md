# Proposal: usage-dashboard

## Why

The Admin can read the activity log — a reverse-chronological list of what happened — but cannot answer the questions they actually have: who is using this system, who has stopped, is Tuesday busier than Sunday, is the HR role doing anything at all. A list of 230 sentences does not answer any of those; a shape does.

Two gaps stand in the way, and both are in the code rather than in the design:

- **Logins are not recorded at all.** `login()` sets the session cookie and redirects. «כמות הכניסות» has no data today — not a low number, no data.
- **`logActivity` cannot record one.** It resolves the actor from the session, deliberately («no caller can attribute an act to someone else»), and returns silently when there is none — which is exactly the state during a login. A naive call there would write nothing and look like it worked.

## What Changes

- **Successful logins are recorded**, through a narrow, named exception to the actor rule: one function that takes the just-authenticated user explicitly, documented as the only such door. `User.lastLoginAt` is stamped at the same moment — a fact that survives log pruning, which is what «dormant» must be derived from.
- A new Admin-only **«דשבורד פעילות»** under the ניהול menu, beside the activity log it summarises:
  - four tiles — active users of total, logins, actions, dormant;
  - activity over time, one bar per day;
  - a breakdown by action family, taken from the action names' own prefixes (`person.*`, `org.*`, …) — no new taxonomy;
  - a per-user table: role, logins, actions, last activity, and a sparkline;
  - selecting a user narrows the whole page to them.
- **The windows the page offers come from the log's own retention** (`ACTIVITY_LOG_DAYS`), never from a separate setting: a window longer than what is kept would draw a decline that is really a deletion. The page states the retention it is working within.
- **Days are bucketed in Asia/Jerusalem**, not UTC — an action at 00:30 local is 21:30 UTC the previous day, and would otherwise land in the wrong column every night.
- **Two exports**, both of the current selection: a PDF of the visual report (the chromium already in the image, as the org tree and the person plan use) and an `.xlsx` of the underlying rows (the `xlsx` already used by the people export).

## Capabilities

### Modified

- `activity-log`: gains the login-recording requirement and the usage-dashboard requirement.

## Impact

- `prisma/schema.prisma` + migration: `User.lastLoginAt`.
- `web/src/lib/activity-log.ts` — `logLogin(user)`, the documented exception.
- `web/src/lib/auth-actions.ts` — record on successful login.
- New: `web/src/lib/usage-stats.ts` (aggregation), `web/src/app/system/usage/page.tsx`, an export route, and the sparkline/bar pieces.
- `web/src/components/AdminMenu.tsx` — the entry.
