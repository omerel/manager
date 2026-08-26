"use client";

import { useState } from "react";
import { FileSpreadsheet, X } from "lucide-react";

/**
 * Choose the columns, then download the registry.
 *
 * The catalogue arrives as props rather than being imported: it is built from
 * the card schema on the server, and importing that module here would drag
 * prisma into the client bundle. The form posts only the chosen keys — WHO is
 * exported is the server's decision, from the requester's own visibility.
 */
export function PeopleExportDialog({ columns }: { columns: { key: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  // every value on the card, by default — the export is meant to be complete
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(columns.map((c) => c.key)));

  const toggle = (key: string) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-stone-50"
      >
        <FileSpreadsheet className="h-4 w-4" aria-hidden />
        ייצוא לאקסל
      </button>
    );
  }

  return (
    <>
      <button type="button" disabled className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm">
        <FileSpreadsheet className="h-4 w-4" aria-hidden />
        ייצוא לאקסל
      </button>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={() => setOpen(false)}>
        <div
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-2xl"
        >
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold text-brand-900">ייצוא מרשם האנשים</h2>
            <button type="button" onClick={() => setOpen(false)} className="rounded p-1 text-muted hover:bg-stone-100" title="סגור">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          {/* stated where the decision is made, not discovered in the file */}
          <p className="mt-1 text-sm text-muted">
            הייצוא כולל את <b>כל האנשים בראותך</b> — גם אם הטבלה מסוננת. בחר/י אילו שדות מכרטיס העובד ייכללו כעמודות.
          </p>

          <form action="/api/people-export" method="post" className="mt-4 space-y-4">
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => setChosen(new Set(columns.map((c) => c.key)))}
                className="rounded-md border border-border px-2.5 py-1 hover:bg-stone-50"
              >
                סמן הכל
              </button>
              <button
                type="button"
                onClick={() => setChosen(new Set())}
                className="rounded-md border border-border px-2.5 py-1 hover:bg-stone-50"
              >
                נקה הכל
              </button>
              <span className="self-center text-muted">נבחרו {chosen.size} מתוך {columns.length}</span>
            </div>

            <div className="grid max-h-72 grid-cols-2 gap-1 overflow-y-auto rounded-md border border-border p-2">
              {columns.map((c) => (
                <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-stone-50">
                  <input type="checkbox" checked={chosen.has(c.key)} onChange={() => toggle(c.key)} />
                  {c.label}
                </label>
              ))}
              {[...chosen].map((key) => (
                <input key={key} type="hidden" name="column" value={key} />
              ))}
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-border px-4 py-1.5 text-sm hover:bg-stone-50"
              >
                ביטול
              </button>
              <button
                type="submit"
                disabled={chosen.size === 0}
                className="flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <FileSpreadsheet className="h-4 w-4" aria-hidden />
                הורד קובץ
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
