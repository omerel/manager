# Tasks: action-error-toasts

- [x] 1. `web/src/lib/action-state.ts`: `ActionState` type and `withState(fn)` — catch `Error` → `{ error }`, rethrow `digest` starting `"NEXT_"`, success → `{ done }`.
- [x] 2. `web/src/components/ActionForm.tsx`: client form running the wrapped action via `useActionState`; on `state.error` render the red toast (dismiss ✕, ~8s auto-dismiss); disable submits while pending.
- [x] 3. Sweep all bare `action={...}` form sites (~95, grep-driven) to `ActionForm`, leaving HierarchyTree, DevWipe and EmailRunButton untouched.
- [x] 4. `web/src/app/error.tsx`: branded recovery boundary (home link + reset), no reason display.
- [x] 5. Verify: `npx tsc --noEmit`; `web/scripts/verify-action-toasts.ts` (wrapper unit checks, zero-bare-sites sweep, bad-submit returns 200 with reason in payload) passing twice; `npm run build` clean.
