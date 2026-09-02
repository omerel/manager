# Tasks: usage-dashboard

- [x] 1. Schema: `User.lastLoginAt DateTime?`; migration `user_last_login`; `prisma generate`.
- [x] 2. `activity-log.ts`: `logLogin(user)` — the named exception that supplies the actor, documented as the only one; `auth-actions.ts` calls it on a successful sign-in and stamps `lastLoginAt`.
- [x] 3. `usage-stats.ts`: `availableWindows()` from `ACTIVITY_LOG_DAYS`; `usageStats({ days, userId? })` returning tiles, per-day buckets (`AT TIME ZONE 'Asia/Jerusalem'`), family breakdown, and per-user rows with sparkline series.
- [x] 4. `system/usage/page.tsx` (Admin-only): the window and user selectors, four tiles, the daily bars, the family breakdown, the per-user table with sparklines; the line stating what is counted and the retention in force.
- [x] 5. Export route: `format=pdf` (chromium) and `format=xlsx` (`xlsx`), both over the current window and selection; Admin-only.
- [x] 6. `AdminMenu.tsx`: the «דשבורד פעילות» entry.
- [x] 7. Verify: `npx tsc --noEmit`; new `web/scripts/verify-usage-dashboard.ts` passing twice; `verify-activity-log` green; `npm run build` clean.
