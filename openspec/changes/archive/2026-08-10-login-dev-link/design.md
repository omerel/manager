# Design: login-dev-link

## Context

The system already has exactly this shape of feature twice over: the system name and the logo are Admin-editable `AppSetting` rows read by the login page. The dev-site link is a third instance of the same pattern, plus one new element — a visibility toggle. No new infrastructure is warranted.

## Decisions

### Three keys, one getter

`loginLinkText`, `loginLinkUrl`, `loginLinkEnabled` in `AppSetting`. A single `getLoginLink()` returns `{ text, url, enabled }` with the text defaulting to «לאתר הפיתוח» when unset — mirroring `getSystemName`'s default behaviour. The functions live in `branding.ts` beside their siblings; a separate file for three keys would scatter the pattern.

- `text`: empty/whitespace reverts to the default (row deleted), exactly like the system name.
- `url`: stored as given after `trim()`; empty deletes the row. Accept `http://` and `https://` absolute URLs only — reject anything else in the action with a Hebrew error, since a `javascript:` value here would be an Admin-planted XSS on the one page shown to logged-OUT users.
- `enabled`: row present with `"1"` = shown; absent or anything else = hidden. Default hidden — a fresh install shows nothing until the Admin opts in.

### The card renders only when it can work

Login page shows the card when `enabled && url`. An enabled card with no URL is a button to nowhere; silently not rendering beats rendering a broken control. The settings page states this rule in its helper text so the Admin isn't left wondering why the card hasn't appeared.

### Appearance on the login page

A quiet card beneath the form, same visual family (`rounded-xl border border-border/70 bg-card shadow-sm`): the editable text as a line, and the link as a full-width bordered button labelled «מעבר לאתר» with an external-link icon — a destination, not an action, so it is NOT brand-solid like the submit button; the login button keeps its primacy. `rel="noopener noreferrer"` on the anchor, opening in a new tab so a half-typed username isn't lost.

### One save action

A single `updateLoginLink(formData)` server action (in `branding-actions.ts`) saves text + URL + enabled together — one form, one button, one activity-log entry («עדכן את קישור אתר הפיתוח»). Guarded by `requireAdmin`. The toggle is a checkbox in the same form rather than a separate button: the three values are one setting and should not be able to drift apart across two forms.

## Risks / Trade-offs

- **Open redirect by design**: the login page will link wherever the Admin points it. That is the feature; the guard is that only the Admin can set it, the value is validated to http(s), and the change is activity-logged.
- The login page gains one more DB read; it already reads two settings, and `getLoginLink` batches its keys in one `findMany`.
