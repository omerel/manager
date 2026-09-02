# Design: usage-dashboard

## Approach

One aggregation module answers every question the page asks, for a window and an optional user; the page, the PDF and the spreadsheet are three renderings of that one answer. Nothing new is collected beyond sign-ins — the write trail already in the log is the rest of the data.

```
   ACTIVITY_LOG_DAYS ──▶ which windows may be offered
                              │
   ActivityLog + User ──▶ usageStats(window, userId?) ──┬─▶ the page
                                                        ├─▶ PDF (chromium)
                                                        └─▶ .xlsx
```

## Decisions

1. **`logLogin(user)` is a named exception, not a loosening.** `logActivity` resolves the actor from the session on purpose and writes nothing without one — which is precisely the state during a sign-in, so calling it there would silently record nothing. Rather than adding an optional actor parameter to the general function (which would let any caller attribute anything to anyone), a second exported function takes the just-authenticated user, states in its comment why it exists, and is called from one place.

2. **`User.lastLoginAt` carries dormancy.** Derived from the log, "has not signed in for 30 days" would become true the moment pruning deleted the evidence — a dormancy that is really an amnesia. A column on the user is one write per sign-in and cannot lie that way.

3. **Windows are derived from retention, per the decision**: the page offers 7 / 30 / 90 days filtered to what `ACTIVITY_LOG_DAYS` keeps (all three when it is 0, meaning keep everything), and prints the retention it is working within. No second setting to drift.

4. **Days are bucketed in the application, from ONE read of the window** — reversing the first instinct, which was a `date_trunc(... AT TIME ZONE ...)` per chart. Two reasons decided it. The page needs four different aggregations of the same rows — the timeline, the families, each user's totals, and each user's per-day series — which in SQL is three or four queries plus a user×day cross join for the sparklines, against one pass here. And the window is bounded by the log's own retention (thirty days by default), so "every row in the window" is a small, self-limiting set rather than the whole table.

   The timezone is handled by `Intl.DateTimeFormat` with `timeZone: "Asia/Jerusalem"`, which resolves the day through the ICU database and is therefore right across a DST change — something a fixed offset would get wrong twice a year.

5. **Action families come from the names themselves** — the prefix before the first dot (`person`, `org`, `plan`, `user`, `hr`, `eval`, `grant`, `branding`, `dev`, `auth`). The data already carries the taxonomy; a mapping table would be a second place to update every time an action is added, and would silently mis-file the ones nobody remembered.

6. **"Active" and "dormant" are stated on the page, not left to inference**: active = at least one sign-in or action within the window; dormant = no sign-in for 30 days, from `lastLoginAt`. Two different clocks on purpose — activity is about the window being examined, dormancy is about the person.

7. **Sign-ins are counted from the log** (`auth.login` entries), so the number and the timeline agree by construction; `lastLoginAt` answers only "when last", never "how many".

8. **The exports reuse what exists**: the PDF prints an HTML rendering of the same figures through the chromium already in the image; the spreadsheet is written with `xlsx`, already a dependency. No new packages.

## Risks

- **A dashboard of who did what is closer to surveillance than anything else here**, and this system deliberately keeps a user's rules private even from the Admin. Confining it to the Admin, counting only sign-ins and already-logged writes, and recording no page views keeps it a measure of *use of the system* rather than of a person's day. Worth stating to users if it ships.
- **Sparse data reads as inactivity.** With writes as the only signal, a commander who reads daily and edits monthly looks quiet. The page names what it counts, in a line, so the number is not mistaken for something it is not.

## Verification

`web/scripts/verify-usage-dashboard.ts`:
- sign-in: through the real login form in a browser, an `auth.login` entry appears and `lastLoginAt` is stamped; a refused sign-in writes neither — the check that would catch the silent-no-op trap;
- aggregation: with planted entries at known times, the per-day buckets, the family breakdown and the per-user totals come out exactly; an entry at 00:30 Israel time lands on its own day, not the previous one (asserted against a UTC bucketing, which would fail it);
- windows: with retention at 30, no 90-day window is offered, and the stated period matches;
- narrowing: selecting a user reduces every figure to theirs;
- authority: a Manager and an HR user are refused the page and both exports;
- exports: the PDF starts `%PDF` and is of substance; the workbook reads back with the same totals the page shows.
