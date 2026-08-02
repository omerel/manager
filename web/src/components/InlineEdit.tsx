"use client";

import { useState, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import { SubmitButton } from "@/components/SubmitButton";

/**
 * Row that flips between a read-only summary and an edit form. The fields are
 * passed as children and rendered on the server, so only the open/closed state
 * lives on the client; submitting posts to the server action like any form.
 */
export function InlineEdit({
  view,
  action,
  children,
  title = "ערוך",
  className,
}: {
  view: ReactNode;
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  title?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className={`flex items-center gap-1 ${className ?? ""}`}>
        {view}
        <button
          type="button"
          onClick={() => setOpen(true)}
          title={title}
          className="rounded p-1 text-muted hover:bg-brand-50 hover:text-brand-700"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <form
      action={action}
      onSubmit={() => setOpen(false)}
      className={`flex flex-wrap items-end gap-2 rounded-lg bg-brand-50/60 p-2 ${className ?? ""}`}
    >
      {children}
      <SubmitButton className="rounded-md bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60">
        שמור
      </SubmitButton>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded-md border border-border px-3 py-1 text-xs hover:bg-stone-50"
      >
        ביטול
      </button>
    </form>
  );
}
