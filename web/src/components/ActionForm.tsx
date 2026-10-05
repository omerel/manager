"use client";

import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from "react";
import type { ActionState } from "@/lib/action-state";
import { runWithState } from "@/lib/form-state";
import { OutcomeToast, DEFAULT_CONFIRM, CONFIRM_MS, ERROR_MS } from "@/components/OutcomeToast";

/**
 * A drop-in <form> that reports its outcome — a refusal, and a success.
 *
 * Give it the server action exactly as a bare <form action={...}> would take
 * it; submission runs through the runWithState bridge, so a thrown Hebrew
 * message comes back as state and pops the toast — with the page, and what
 * the user typed, intact.
 *
 * CONFIRMING IS THE DEFAULT, and that is the point rather than a convenience.
 * `withState` has returned `{ done }` on every success since it was written,
 * and this component already received it — and used it only to reset the form.
 * Ninety-odd forms stayed silent because showing it was something each one
 * would have had to ask for. A page that re-renders into the state it was
 * already in is indistinguishable from one where nothing happened, and the
 * honest reading of that is failure. So: on by default, off by decision.
 *
 * Where the outcome is already evident — a row that vanishes, an action that
 * navigates elsewhere — pass `confirm={false}`, and the absence of a toast
 * becomes something a reader can see was chosen.
 *
 * Submission is driven from onSubmit + startTransition rather than the native
 * action pass-through, deliberately: React resets an uncontrolled form after a
 * native action round-trip, which would wipe the user's input on FAILURE. The
 * manual path resets only on success — matching the old behavior where it was
 * wanted, removing it where it hurt.
 */
export function ActionForm({
  action,
  onDone,
  confirm: confirmMessage,
  confirmText,
  className,
  children,
}: {
  action: (formData: FormData) => void | Promise<unknown>;
  /** called after a successful submit — for closing a modal, clearing local UI */
  onDone?: () => void;
  /** native confirm() gate: submission proceeds only if the user agrees */
  confirm?: string;
  /**
   * The success confirmation. `true`/omitted gives the neutral default, a
   * string replaces it, and `false` suppresses it — for the forms whose result
   * the user can already see happen.
   */
  confirmText?: string | false;
  className?: string;
  children: React.ReactNode;
}) {
  const bridged = useMemo(() => runWithState.bind(null, action), [action]);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(bridged, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [toast, setToast] = useState<{ kind: "error" | "done"; text: string } | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!state) return;
    if ("error" in state) {
      setToast({ kind: "error", text: state.error });
      const t = setTimeout(() => setToast(null), ERROR_MS);
      return () => clearTimeout(t);
    }
    formRef.current?.reset();
    onDoneRef.current?.();
    if (confirmText === false) return;
    // a second save replaces the first toast rather than stacking on it
    setToast({ kind: "done", text: confirmText || DEFAULT_CONFIRM });
    const t = setTimeout(() => setToast(null), CONFIRM_MS);
    return () => clearTimeout(t);
  }, [state, confirmText]);


  return (
    <form
      ref={formRef}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return; // double-submit guard (useFormStatus is inert here — the fieldset disables instead)
        if (confirmMessage && !window.confirm(confirmMessage)) return;
        const submitter = (e.nativeEvent as SubmitEvent).submitter;
        const fd = new FormData(e.currentTarget, submitter);
        startTransition(() => formAction(fd));
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {toast && <OutcomeToast kind={toast.kind} text={toast.text} onClose={() => setToast(null)} />}
    </form>
  );
}
