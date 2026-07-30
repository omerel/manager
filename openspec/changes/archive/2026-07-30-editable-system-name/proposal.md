## Why

The system name is hard-coded ("ניהול קריירה") in the nav, login page, browser-tab title, and PDF report footer — while the logo beside it is already admin-editable. Organizations naming their own deployment need the title configurable the same way.

## What Changes

- **Admin-editable system name** — a new field in the existing branding section on the system-settings page, stored in the existing `AppSetting` key-value table (no migration). Default: **"Manager"**; clearing the field reverts to the default.
- **Applied everywhere the name renders**: nav bar (signed-in and signed-out), login page, browser-tab title (layout metadata), and the PDF export meta line.
- Agent prompt texts that *describe* the domain ("מערכת ניהול קריירה") are instructions to the model, not branding — unchanged.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `branding`: adds an admin-editable system name (default "Manager") alongside the logo.

## Impact

- `src/lib/branding.ts` (getSystemName/setSystemName), `/system` page field + action, Header, login, layout metadata, PDF route. No schema migration.
