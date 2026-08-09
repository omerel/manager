"use client";

import { useMemo, useState } from "react";

export type TargetOption = { value: string; label: string; source: string };

/**
 * One column's mapping targets: a search box over checkbox rows, each row
 * naming its SOURCE — כרטיס עובד, or the career plans that carry the label.
 *
 * Checkboxes replaced the ctrl-click multi-select: a tick is visible and
 * togglable one-handed, and "nothing ticked" IS the ignore state — which also
 * removes the duplicated «התעלם» entry the select needed. Selected values ride
 * as hidden inputs under the given field name.
 */
export function TargetPicker({
  name,
  options,
  defaultSelected = [],
}: {
  name: string;
  options: TargetOption[];
  defaultSelected?: string[];
}) {
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(defaultSelected));

  const visible = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.source.toLowerCase().includes(q));
  }, [term, options]);

  const toggle = (v: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });

  return (
    <div className="w-64">
      {[...selected].map((v) => (
        <input key={v} type="hidden" name={name} value={v} />
      ))}
      <input
        type="text"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="חיפוש יעד…"
        className="mb-1 w-full rounded-md border border-border px-2 py-1 text-xs"
      />
      <div className="max-h-44 overflow-auto rounded-md border border-border">
        {visible.length === 0 ? (
          <p className="px-2 py-1.5 text-xs text-muted">אין יעד התואם ל״{term}״</p>
        ) : (
          visible.map((o) => (
            <label
              key={o.value}
              className={`flex cursor-pointer items-start gap-2 px-2 py-1 text-xs hover:bg-slate-50 ${
                selected.has(o.value) ? "bg-brand-50" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(o.value)}
                onChange={() => toggle(o.value)}
                className="mt-0.5 accent-brand-600"
              />
              <span className="flex flex-col">
                <span className="font-medium">{o.label}</span>
                <span className="text-muted">{o.source}</span>
              </span>
            </label>
          ))
        )}
      </div>
      <p className="mt-0.5 text-[11px] text-muted">{selected.size === 0 ? "ללא סימון = התעלם מהעמודה" : `${selected.size} יעדים`}</p>
    </div>
  );
}
