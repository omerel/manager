"use client";

import { AlertTriangle, X } from "lucide-react";

/**
 * The one delete confirmation in the system.
 *
 * Every destructive action in the app is irreversible and none of them ask the
 * user to type anything: what stands between the admin and the deletion is a
 * dialog that states, in real counts read from the database, what is about to
 * be destroyed. That only works if the dialog is the same everywhere — a second
 * implementation is a second chance to show a vaguer warning.
 *
 * `title` names the thing. `children` is the evidence. `confirmLabel` carries
 * the consequence, not the word "OK".
 */
export function ConfirmDelete({
  title,
  confirmLabel,
  onCancel,
  children,
  action,
  hidden,
}: {
  title: string;
  confirmLabel: string;
  onCancel: () => void;
  children: React.ReactNode;
  /** server action the confirm button submits */
  action: (formData: FormData) => void | Promise<void>;
  /** hidden inputs the action needs, e.g. the id */
  hidden: Record<string, string>;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={onCancel}>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-red-800">
            <AlertTriangle className="h-5 w-5" aria-hidden />
            {title}
          </h2>
          <button type="button" onClick={onCancel} className="rounded p-1 text-muted hover:bg-stone-100" title="סגור">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="mt-3 space-y-2 text-sm">{children}</div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border px-4 py-1.5 text-sm hover:bg-stone-50"
          >
            ביטול
          </button>
          <form action={action} onSubmit={onCancel}>
            {Object.entries(hidden).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <button className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700">
              {confirmLabel}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/** Counted evidence line: "3 חוות דעת". Hebrew has no -s, so both forms are given. */
export function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}
