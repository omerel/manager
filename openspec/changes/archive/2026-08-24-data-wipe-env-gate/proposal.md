# Proposal: data-wipe-env-gate

## Why

The data wipe was shipped as development-only with no override — and the air-gapped deployment turned out to need it: the admin there has no other way to clear test data between rehearsals. Flipping `NODE_ENV` cannot work (the check is inlined at build) and is harmful anyway. The system already has the shape for this: `DEV_USER_SWITCH === "1"` is an explicit env gate for a dev convenience in a shipped image.

## What Changes

- One predicate, `dataWipeEnabled()`: true in a development build, or when `ENABLE_DATA_WIPE === "1"` in the runtime environment. Both existing gates — the section's render and the action's first check — go through it.
- Default unchanged: a production image without the variable neither renders the section nor accepts the action. Enabling it is an explicit per-deployment decision in `app.env`.
- The admin-only check and the confirmation ceremony stay exactly as they are.
- `deploy/app.env.example` documents the variable with a warning, next to `DEV_USER_SWITCH`'s.

## Capabilities

### Modified

- `branding`: the data-wipe requirement's availability rule becomes "development build, or the explicit env gate", with a scenario for the gated production case.

## Impact

- `web/src/lib/dev-wipe.ts` — the predicate.
- `web/src/lib/dev-wipe-actions.ts`, `web/src/app/system/page.tsx` — both gates route through it.
- `deploy/app.env.example` — documentation.
- `web/scripts/verify-dev-wipe.ts` — the gate checks learn the override.
