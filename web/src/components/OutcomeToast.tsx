"use client";

import { Check, X } from "lucide-react";

/** The neutral wording. The same mechanism carries saves, deletions and
 *  dispatches, so "נשמר" would be a small lie on half of them — and a default
 *  that lies teaches the reader to stop reading. */
export const DEFAULT_CONFIRM = "הפעולה בוצעה";

/** A refusal is read, understood and acted on; a confirmation only has to be
 *  noticed. One that lingers like an error teaches the user to ignore both. */
export const CONFIRM_MS = 2200;
export const ERROR_MS = 8000;

/**
 * How an action's outcome is told to the user — one definition, both kinds.
 *
 * Extracted when a second place needed to confirm: the framework editor in
 * HierarchyTree, which runs its own useActionState rather than ActionForm. Two
 * copies of this markup would be two toasts that drift apart in colour, timing
 * and wording, and the user would meet both.
 *
 * A refusal is `alert` — it interrupts, because it has to be acted on. A
 * confirmation is `status` — announced without cutting in. Same mechanism,
 * different urgency.
 */
export function OutcomeToast({
  kind,
  text,
  onClose,
}: {
  kind: "error" | "done";
  text: string;
  onClose: () => void;
}) {
  const error = kind === "error";
  return (
    <div
      role={error ? "alert" : "status"}
      data-action-toast={error ? "" : undefined}
      data-action-confirm={error ? undefined : ""}
      className={`fixed inset-x-0 top-4 z-[60] mx-auto flex w-fit max-w-[min(90vw,32rem)] items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg ${
        error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"
      }`}
    >
      {!error && <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
      <span>{text}</span>
      <button
        type="button"
        onClick={onClose}
        className={`rounded p-0.5 ${
          error
            ? "text-red-400 hover:bg-red-100 hover:text-red-700"
            : "text-emerald-500 hover:bg-emerald-100 hover:text-emerald-800"
        }`}
        aria-label="סגור הודעה"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
