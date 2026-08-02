"use client";

import { useFormStatus } from "react-dom";

/**
 * A submit button that locks itself while its form's action is in flight.
 *
 * Exists because of a reproduced bug: on a slow round-trip, clicking "הוסף
 * מחזורי" showed no immediate feedback, a second click went through, and the
 * plan ended up with identical recurring events (three copies of one event on
 * the dev registry). A double-click in the test created two rows; with this
 * button it creates one.
 *
 * Must render INSIDE the form — useFormStatus reads the status of the nearest
 * enclosing form.
 */
export function SubmitButton({
  children,
  className = "rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60",
  pendingText = "שומר…",
}: {
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={className}>
      {pending ? pendingText : children}
    </button>
  );
}
