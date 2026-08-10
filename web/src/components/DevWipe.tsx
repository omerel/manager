"use client";

import { useActionState, useEffect, useState } from "react";
import { devWipe, type WipeState } from "@/lib/dev-wipe-actions";
import { WIPE_CATEGORIES } from "@/lib/dev-wipe-categories";

/**
 * Tick → warn → count. The warning is inline rather than a modal: the whole
 * ceremony stays inside the section, since nothing else on the page is at
 * stake. Nothing is submitted until אישור מחיקה.
 */
export function DevWipe() {
  const [state, formAction, pending] = useActionState<WipeState, FormData>(devWipe, null);
  const [ticked, setTicked] = useState<Set<string>>(() => new Set());
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (state) {
      setConfirming(false);
      if (state.ok) setTicked(new Set());
    }
  }, [state]);

  const toggle = (key: string) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const tickedLabels = WIPE_CATEGORIES.filter((c) => ticked.has(c.key)).map((c) => c.label);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {WIPE_CATEGORIES.map((c) => (
          <label
            key={c.key}
            className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm ${
              ticked.has(c.key) ? "border-red-300 bg-red-50" : "border-border hover:bg-stone-50"
            }`}
          >
            <input
              type="checkbox"
              name="category"
              value={c.key}
              checked={ticked.has(c.key)}
              onChange={() => toggle(c.key)}
              className="mt-0.5 accent-red-600"
            />
            <span className="flex flex-col">
              <span className="font-medium">{c.label}</span>
              <span className="text-xs text-muted">{c.hint}</span>
            </span>
          </label>
        ))}
      </div>

      {state && !state.ok && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{state.error}</div>
      )}
      {state?.ok && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {`המחיקה בוצעה בהצלחה. נמחקו: ${state.counts.map((c) => `${c.count} ${c.label}`).join(", ")}.`}
        </div>
      )}

      {confirming ? (
        <div className="space-y-2 rounded-md border border-red-300 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-900">
            {`פעולה זו תמחק לצמיתות: ${tickedLabels.join(", ")}. להמשיך?`}
          </p>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {pending ? "מוחק…" : "אישור מחיקה"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="rounded-md border border-border px-4 py-1.5 text-sm hover:bg-white"
            >
              ביטול
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={ticked.size === 0}
          onClick={() => setConfirming(true)}
          className="rounded-md border border-red-300 px-4 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          מחיקה
        </button>
      )}
    </form>
  );
}
