# Proposal: action-error-toasts

## Why

The system's server actions refuse bad input with 124 carefully-worded Hebrew messages — and in the shipped build not one of them reaches the user. A thrown server-action error unmounts the page into Next's generic error screen, and production **redacts the message entirely** (a digest is all that survives). The user loses the page, their typed input, and the reason at once. Only 3 of ~98 forms use the state-returning pattern that displays errors properly.

## What Changes

- A server-side wrapper (`withState`) turns any thrown action `Error` into returned state `{ error }`, while re-throwing Next control-flow signals (`redirect`/`notFound`) untouched — 10 action files rely on redirect-after-success.
- A shared client form (`ActionForm`) replaces bare `<form action={...}>`: it runs the wrapped action through `useActionState` and, on error, pops a dismissible red toast with the reason. The user stays on the page with their input intact.
- All ~95 direct form call sites convert mechanically to `ActionForm`. The actions themselves — and all 124 messages — are untouched.
- A global `error.tsx` is added as a last-resort net for anything unforeseen (it cannot show reasons in production, only offer recovery).
- The 3 forms already returning inline errors (HierarchyTree, DevWipe, EmailRunButton) stay exactly as they are.

## Capabilities

### New

- `error-surfacing`: user-facing failure handling — refusals reach the user as messages in place, never as a dead page.

## Impact

- New: `web/src/lib/action-state.ts` (wrapper), `web/src/components/ActionForm.tsx` (form + toast), `web/src/app/error.tsx`.
- Edited: every page/component with a bare `action={...}` form (~30 files, mechanical swap).
- No schema change, no new packages, no settings.
