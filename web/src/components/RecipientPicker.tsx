"use client";

import { useMemo, useRef, useState } from "react";
import { AtSign, UserX, X } from "lucide-react";
import { KIND_LABEL, type OrgKindStr } from "@/lib/org-kinds";

export type DefaultRecipient = {
  nodeId: string;
  name: string;
  kind: OrgKindStr;
  commanderName: string | null;
};
export type AddableFramework = { nodeId: string; path: string; kind: OrgKindStr; commanderName: string };
export type HrOption = { userId: string; name: string };

/**
 * Who a query goes to.
 *
 * The level below arrives as a checkbox list, all pre-checked — sending without
 * touching it reaches exactly the audience the automatic rule used to. The ‎@‎
 * field adds any commanded framework in the system; typing alone never adds
 * one, only choosing from the list does, the same discipline as the person-tag
 * picker.
 *
 * A hidden `recipientsExplicit` marker always submits with this form. Unchecked
 * checkboxes submit nothing at all, so without the marker an empty selection
 * would be indistinguishable from an old form with no recipients field — and
 * would silently fall back to "everyone", the exact opposite of what unchecking
 * everyone means.
 *
 * A LATERAL sender (משא״ן) gets the same list with nothing pre-checked and no
 * ‎@‎ field: "the level below" is a chain notion they are not part of, and ‎@‎
 * reaches outside the subtree that defines their whole reach. They get a
 * select-all instead, because asking everyone in your framework at once is the
 * normal shape of the work rather than an edge case.
 */
export function RecipientPicker({
  defaults,
  addable,
  preselect = true,
  hr = [],
}: {
  defaults: DefaultRecipient[];
  addable: AddableFramework[];
  /** false for a lateral sender: nothing is a default when there is no chain */
  preselect?: boolean;
  /** HR users with EDIT coverage of the sender's framework — person recipients */
  hr?: HrOption[];
}) {
  const [hrChecked, setHrChecked] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState<Set<string>>(
    new Set(preselect ? defaults.map((d) => d.nodeId) : []),
  );
  const [added, setAdded] = useState<AddableFramework[]>([]);
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const defaultIds = useMemo(() => new Set(defaults.map((d) => d.nodeId)), [defaults]);
  const matches = useMemo(() => {
    if (!open) return [];
    const q = term.trim().toLowerCase();
    const pool = addable.filter((f) => !defaultIds.has(f.nodeId) && !added.some((a) => a.nodeId === f.nodeId));
    return (q ? pool.filter((f) => f.path.toLowerCase().includes(q) || f.commanderName.toLowerCase().includes(q)) : pool).slice(0, 8);
  }, [open, term, addable, added, defaultIds]);

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const add = (f: AddableFramework) => {
    setAdded((prev) => [...prev, f]);
    setTerm("");
    setOpen(false);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || matches.length === 0) {
      if (e.key === "Enter") e.preventDefault(); // never submit from this field
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      add(matches[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  const count = checked.size + added.length + hrChecked.size;

  return (
    <div className="space-y-2">
      <input type="hidden" name="recipientsExplicit" value="1" />
      {[...checked].map((id) => (
        <input key={id} type="hidden" name="recipients" value={id} />
      ))}
      {added.map((f) => (
        <input key={f.nodeId} type="hidden" name="recipients" value={f.nodeId} />
      ))}
      {[...hrChecked].map((id) => (
        <input key={id} type="hidden" name="hrRecipients" value={id} />
      ))}

      <span className="text-sm text-muted">
        נמענים <span className="text-xs">({count})</span>
      </span>
      {!preselect && defaults.length > 0 && (
        <button
          type="button"
          onClick={() =>
            setChecked((prev) =>
              prev.size === defaults.length ? new Set() : new Set(defaults.map((d) => d.nodeId)),
            )
          }
          className="rounded-md border border-border px-2 py-0.5 text-xs hover:bg-stone-50"
        >
          {checked.size === defaults.length ? "נקה הכל" : "סמן הכל"}
        </button>
      )}

      <ul className="flex flex-wrap gap-2">
        {defaults.map((d) => (
          <li key={d.nodeId}>
            <label
              className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-sm ${
                checked.has(d.nodeId) ? "border-brand-300 bg-brand-50" : "border-border bg-card text-muted"
              }`}
            >
              <input
                type="checkbox"
                checked={checked.has(d.nodeId)}
                onChange={() => toggle(d.nodeId)}
                className="accent-brand-600"
              />
              <span className="text-xs text-muted">{KIND_LABEL[d.kind]}</span>
              <span className="font-medium">{d.name}</span>
              {d.commanderName ? (
                <span className="text-xs text-muted">· {d.commanderName}</span>
              ) : (
                <span className="flex items-center gap-0.5 rounded bg-amber-100 px-1 text-xs text-amber-900">
                  <UserX className="h-3 w-3" aria-hidden />
                  אין מפקד
                </span>
              )}
            </label>
          </li>
        ))}
        {added.map((f) => (
          <li key={f.nodeId}>
            <span className="flex items-center gap-1.5 rounded-md border border-brand-300 bg-brand-50 px-2 py-1 text-sm">
              <AtSign className="h-3 w-3 text-brand-700" aria-hidden />
              <span className="font-medium">{f.path}</span>
              <span className="text-xs text-muted">· {f.commanderName}</span>
              <button
                type="button"
                onClick={() => setAdded((prev) => prev.filter((x) => x.nodeId !== f.nodeId))}
                title="הסר נמען"
                className="rounded p-0.5 text-muted hover:bg-brand-100 hover:text-brand-800"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          </li>
        ))}
      </ul>

      {hr.length > 0 && (
        <ul className="flex flex-wrap items-center gap-2">
          <li className="text-xs text-muted">משא״ן מטפל:</li>
          {hr.map((h) => (
            <li key={h.userId}>
              <label
                className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-sm ${
                  hrChecked.has(h.userId) ? "border-violet-300 bg-violet-50" : "border-border bg-card text-muted"
                }`}
              >
                <input
                  type="checkbox"
                  checked={hrChecked.has(h.userId)}
                  onChange={() =>
                    setHrChecked((prev) => {
                      const next = new Set(prev);
                      if (next.has(h.userId)) next.delete(h.userId);
                      else next.add(h.userId);
                      return next;
                    })
                  }
                  className="accent-violet-600"
                />
                <span className="rounded bg-violet-100 px-1 text-xs text-violet-900">משא״ן</span>
                <span className="font-medium">{h.name}</span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {addable.length > 0 && (
      <div className="relative">
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted">
          <AtSign className="h-4 w-4" aria-hidden />
        </span>
        <input
          ref={inputRef}
          type="text"
          value={term}
          placeholder="הוסף מפקד מכל מקום בעץ — הקלד לחיפוש…"
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          className="w-96 rounded-md border border-border py-1.5 pl-3 pr-9 text-sm"
        />
        {open && (
          <ul className="absolute z-20 mt-1 max-h-60 w-96 overflow-auto rounded-md border border-border bg-card shadow-lg">
            {matches.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted">
                {term ? `לא נמצאה מסגרת מפוקדת התואמת ל״${term}״` : "כל המסגרות המפוקדות כבר ברשימה"}
              </li>
            ) : (
              matches.map((f, i) => (
                <li key={f.nodeId}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => add(f)}
                    onMouseEnter={() => setActive(i)}
                    className={`flex w-full flex-col items-start px-3 py-1.5 text-start text-sm ${
                      i === active ? "bg-brand-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <span className="font-medium">{f.path}</span>
                    <span className="text-xs text-muted">
                      {KIND_LABEL[f.kind]} · מפקד: {f.commanderName}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      )}
    </div>
  );
}
