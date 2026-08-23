# Design: action-error-toasts

## Approach

Wrap, don't rewrite. The 124 thrown messages are correct and well-written; the failure is in transport. One server-side adapter converts throw→state at the boundary, one client component converts state→toast, and every call site swaps `<form>` for `<ActionForm>` without touching its inputs, layout, or the action's logic.

```
form submit ─▶ withState(action) ─▶ action throws Error("סיבה")
                     │ catch
                     ▼
              { error: "סיבה" } ─▶ ActionForm (useActionState)
                                        │ state.error
                                        ▼
                              🔴 toast, auto-dismiss + ✕
                              (page and typed input intact)
```

## Decisions

1. **`withState(fn)` in `web/src/lib/action-state.ts`, applied through ONE bridge.** `withState` catches `Error` → `{ error: e.message }`, success → `{ done }`, and MUST re-throw Next control-flow errors — anything whose `digest` starts with `"NEXT_"` — or every redirect-after-success in 10 action files silently breaks. Rather than a registry of wrapped variants, a single `"use server"` bridge (`form-state.ts` / `runWithState(action, prev, fd)`) receives the original action as a serialized server-function reference; `ActionForm` binds it client-side. One registered action serves every form; the exported actions keep their throwing contract for scripts and other server callers. (Proven empirically in a browser before the sweep.)

2. **`ActionForm` is a drop-in `<form>`.** Props: the BARE action exactly as `<form action={...}>` took it, plus `className`/`children` passed through, so every form body moves unchanged; `onDone` (fires on success — modal close, local cleanup) and `confirm` (native confirm() gate) absorb the two onSubmit patterns that existed. Submission is dispatched manually (onSubmit + startTransition), deliberately: React resets an uncontrolled form after a native action round-trip, which would wipe the user's input on FAILURE; the manual path resets only on success. `useFormStatus` is inert under manual dispatch — a `<fieldset disabled>` around the children takes over double-submit protection. The wrapper components ConfirmDelete / ConfirmSubmit / InlineEdit were converted INTERNALLY, covering all their call sites at once; ConfirmDelete's dialog now closes on success rather than on submit, so a refused delete keeps the dialog open with the reason toasted above it.

3. **Toast, not modal.** The convention: destructive *confirmations* block (ConfirmDelete already does), failure *notices* don't. The toast is fixed near the top of the viewport, red-tinted like existing error notices (`border-red-200 bg-red-50 text-red-800`), dismissible with ✕, auto-dismisses after ~8s. Rendered per-form — the form that failed owns its toast; two forms can't race one global singleton.

4. **Submit-button pending state comes free.** `useActionState`'s `pending` disables the form's submit buttons via `fieldset disabled` — pick one mechanism and apply it uniformly rather than per-button wiring.

5. **Success is not announced.** Today's forms signal success by the page updating (revalidate/redirect). The toast is for failure only; adding success toasts everywhere is scope creep and noise.

6. **`error.tsx` is a net, not a feature.** It offers "חזרה" and a retry; it cannot show reasons in production and must not pretend to. If it ever shows, something escaped the wrapper — that's the signal it exists to give.

7. **Untouched:** HierarchyTree (inline row errors), DevWipe (inline state ceremony), EmailRunButton — their placement is deliberate and better than a toast.

## Risks

- **A missed call site keeps the old behavior.** The sweep is grep-driven (`action={` minus `formAction`); the verify suite counts remaining bare sites and fails above zero.
- **Actions used both by forms and programmatically** (scripts, other server code) — wrapping at call sites, not at export, keeps those callers seeing throws.

## Verification

`web/scripts/verify-action-toasts.ts`: unit-level — `withState` converts a thrown Hebrew message to `{ error }`, passes `NEXT_REDIRECT` digests through untouched, returns `{ done }` on success; sweep-level — zero bare `action={` form sites outside the three exempted components; rendered-level — submit a knowingly-bad form (e.g. org node without a name) via fetch POST and confirm the response is 200 with the reason in the payload rather than an error page.
