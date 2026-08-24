# Design: data-wipe-env-gate

## Decisions

1. **The predicate lives in `dev-wipe.ts`** (server-only): `dataWipeEnabled() = NODE_ENV !== "production" || ENABLE_DATA_WIPE === "1"`. Not in `dev-wipe-categories.ts` — that module is deliberately client-safe, and a `process.env` read of a non-`NEXT_PUBLIC` variable in a client bundle silently inlines `undefined`; keeping the predicate server-side means it always reads the real runtime environment.

2. **`ENABLE_DATA_WIPE`, value `"1"`** — mirroring `DEV_USER_SWITCH === "1"`, the existing env gate for a dev convenience in a shipped image. Same shape, same documentation spot in `app.env.example`, same warning tone.

3. **Why this works where `NODE_ENV` flipping cannot**: `NODE_ENV` comparisons are inlined at `next build`; arbitrary env vars in server components and server actions are read at runtime. The section's gate lives in a server component and the action's in a server action, so both see the deployment's actual `app.env`.

4. **The refusal message stays** «כלי פיתוח בלבד — אינו זמין בסביבת ייצור.» — in a gated-off production build that is still the truth being told.

## Verification

Extend `verify-dev-wipe.ts`'s gate section: production + no var → the production refusal (as today); production + `ENABLE_DATA_WIPE="1"` → the env gate opens and the NEXT gate (admin session) refuses instead — proving the override passes the first gate without actually wiping; dev behavior unchanged. Env mutation in-process with restore, as the suite already does for `NODE_ENV`.
