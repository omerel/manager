# Proposal: dev-data-wipe

## Why

The dev database fills with test people, toy plans, chat runs and demo queries, and clearing it today means either the all-or-nothing `reset-db.mjs` (drops the schema, kills the users, requires a pod shell) or hand-deleting through the UI. Development needs a middle tool: wipe one kind of data — people, career plans, chat questions, rules, queries — while keeping users, the org tree, and settings, so the next experiment starts clean without rebuilding logins and hierarchy. This is a development tool by declaration: it must not exist in a production build at all.

## What Changes

- A new «מחיקת נתונים (סביבת פיתוח)» section on the system-settings page, rendered ONLY when the server runs in development mode (`NODE_ENV !== "production"`) — in the delivered image the section is absent and the action refuses.
- Five checkboxes — אנשים, קריירה, שאלות, חוקים, שאילתות — a delete button, a warning-confirmation step naming what was ticked, then a success notice with the deleted counts per category.
- Users are never touched by this tool; the Admin deletes users manually as today. The org tree, settings, activity log and grants also stay.
- The wipe itself is one server action guarded by Admin + dev-mode, deleting by category along the schema's existing cascades, and writing an activity-log entry naming the categories.

## Capabilities

### Modified

- `branding`: the system-settings page gains the dev-only data-wipe section (the page's capability home).

## Impact

- `web/src/lib/dev-wipe-actions.ts` (new): the guarded action with per-category deletes and counts.
- `web/src/components/DevWipe.tsx` (new): checkboxes → confirm → success flow.
- `web/src/app/system/page.tsx`: conditional section.
- No schema change, no new packages.
