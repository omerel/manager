# Tasks: data-wipe-env-gate

- [x] 1. `dev-wipe.ts`: export `dataWipeEnabled()`; route the action's first check (`dev-wipe-actions.ts`) and the section's render (`system/page.tsx`) through it.
- [x] 2. `deploy/app.env.example`: document `ENABLE_DATA_WIPE` with its warning.
- [x] 3. Verify: `npx tsc --noEmit`; `verify-dev-wipe.ts` extended with the env-gate checks, passing twice; `npm run build` clean.
