# Proposal: login-dev-link

## Why

The production and development sites live side by side, and people land on the wrong one — most often on production when they meant to play in dev. The login page is the natural junction: it is the one screen everyone passes through before doing anything, so a small, clearly-worded escape hatch there ("this way to the dev site") costs nothing and prevents test data from being typed into the real system. Because the two environments' addresses differ per deployment and may change, the text and the link must be editable by the Admin, not baked into the build — and the Admin must be able to hide the card entirely on the environment where it makes no sense (the dev site itself, or an air-gapped install with no second site).

## What Changes

- A new card on the login page, shown beneath the login form, carrying an Admin-editable text (default: «לאתר הפיתוח») and a styled link-button to an Admin-editable URL. The card renders only when it is enabled AND a URL has been set — a card with nowhere to go never shows.
- A new «קישור באתר ההתחברות» block in the Admin's הגדרות מערכת page (`/system`): a text field, a URL field, and a visibility toggle (הצג / הסתר). Saving follows the existing branding pattern — `AppSetting` rows, server actions guarded by `requireAdmin`, activity-log entries.
- No schema change: three `AppSetting` keys (`loginLinkText`, `loginLinkUrl`, `loginLinkEnabled`).

## Capabilities

### Modified

- `branding`: the system-settings page gains the login-link block (text, URL, visibility).
- `authentication`: the login page renders the configured card when enabled and configured.

## Impact

- `web/src/lib/branding.ts` (or a sibling `login-link.ts`): getters/setters over `AppSetting`.
- `web/src/lib/branding-actions.ts`: one new server action.
- `web/src/app/system/page.tsx`: new section.
- `web/src/app/login/page.tsx`: conditional card.
- No migration, no new packages (air-gap constraint holds).
