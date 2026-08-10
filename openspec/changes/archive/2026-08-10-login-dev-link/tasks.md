# Tasks: login-dev-link

## 1. Settings plumbing

- [x] 1.1 `branding.ts`: `DEFAULT_LOGIN_LINK_TEXT`, `getLoginLink()` (one `findMany` over the three keys → `{ text, url, enabled }`), `setLoginLink()` (empty text/url delete their rows; enabled stored as `"1"`/absent)
- [x] 1.2 `branding-actions.ts`: `updateLoginLink(formData)` — `requireAdmin`, http/https validation with Hebrew error, one activity-log entry, `revalidatePath("/login")` + `/system`

## 2. UI

- [x] 2.1 `/system` page: «קישור באתר ההתחברות» section — text field, URL field, הצג/הסתר checkbox, one save button, helper text noting the card shows only with a URL set
- [x] 2.2 Login page: conditional card beneath the form — configured text + «מעבר לאתר» bordered link-button (external-link icon, new tab, `rel="noopener noreferrer"`), rendered only when `enabled && url`

## 3. Verification

- [x] 3.1 `scripts/verify-login-link.ts`: defaults (hidden on fresh state; default text), set+enable → login HTML carries text and URL, enabled-without-URL renders nothing, disable hides, clearing text restores default, `javascript:` URL rejected, non-admin blocked from the action
- [x] 3.2 Full sweep: suite twice, `npx tsc --noEmit`, `npm run build`
