"use client";

import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import type { ActionState } from "@/lib/action-state";
import { runWithState } from "@/lib/form-state";

/**
 * A drop-in <form> whose refusals surface as a toast instead of an error page.
 *
 * Give it the server action exactly as a bare <form action={...}> would take
 * it; submission runs through the runWithState bridge, so a thrown Hebrew
 * message comes back as state and pops the toast — with the page, and what
 * the user typed, intact.
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
  className,
  children,
}: {
  action: (formData: FormData) => void | Promise<unknown>;
  /** called after a successful submit — for closing a modal, clearing local UI */
  onDone?: () => void;
  /** native confirm() gate: submission proceeds only if the user agrees */
  confirm?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const bridged = useMemo(() => runWithState.bind(null, action), [action]);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(bridged, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [toastOpen, setToastOpen] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!state) return;
    if ("error" in state) {
      setToastOpen(true);
      const t = setTimeout(() => setToastOpen(false), 8000);
      return () => clearTimeout(t);
    }
    formRef.current?.reset();
    onDoneRef.current?.();
  }, [state]);

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
      {toastOpen && state && "error" in state && (
        <div
          role="alert"
          data-action-toast=""
          className="fixed inset-x-0 top-4 z-[60] mx-auto flex w-fit max-w-[min(90vw,32rem)] items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-lg"
        >
          <span>{state.error}</span>
          <button
            type="button"
            onClick={() => setToastOpen(false)}
            className="rounded p-0.5 text-red-400 hover:bg-red-100 hover:text-red-700"
            aria-label="סגור הודעה"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
    </form>
  );
}
