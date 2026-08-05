"use client";

import { useMemo, useRef, useState } from "react";
import { mentionToken } from "@/lib/mentions";

export type MentionablePerson = { id: string; name: string; team: string };

/**
 * A textarea where `@` opens a person picker.
 *
 * The candidate list is handed down as a prop rather than fetched: it is
 * already clipped to what the writer may see, and a search endpoint would be a
 * second place where that clipping has to be got right.
 *
 * What is typed stays plain text; only choosing from the list inserts a tag. So
 * a writer who types "@דנה" and keeps going has written the characters "@דנה"
 * and nothing more — a tag is always a deliberate act, never an autocorrect.
 */
export function MentionTextarea({
  name,
  people,
  defaultValue,
  rows = 3,
  required,
  className,
  placeholder,
}: {
  name: string;
  people: MentionablePerson[];
  defaultValue?: string;
  rows?: number;
  required?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(defaultValue ?? "");
  // where the active "@..." starts, or null when we are not in one
  const [anchor, setAnchor] = useState<number | null>(null);
  const [term, setTerm] = useState("");
  const [active, setActive] = useState(0);

  const matches = useMemo(() => {
    if (anchor === null) return [];
    const q = term.trim().toLowerCase();
    const pool = q ? people.filter((p) => p.name.toLowerCase().includes(q)) : people;
    return pool.slice(0, 8);
  }, [anchor, term, people]);

  /** Read the caret's surroundings and decide whether we are inside an `@…` run. */
  const sync = (el: HTMLTextAreaElement) => {
    setValue(el.value);
    const caret = el.selectionStart ?? 0;
    const upto = el.value.slice(0, caret);
    const at = upto.lastIndexOf("@");
    // an `@` only opens the picker at a word boundary, and closes at whitespace:
    // an email address in the middle of a sentence must not summon a list
    const boundary = at === 0 || /\s/.test(upto[at - 1] ?? " ");
    const run = upto.slice(at + 1);
    if (at === -1 || !boundary || /\s/.test(run) || run.length > 30) {
      setAnchor(null);
      setTerm("");
      return;
    }
    setAnchor(at);
    setTerm(run);
    setActive(0);
  };

  const insert = (p: MentionablePerson) => {
    const el = ref.current;
    if (!el || anchor === null) return;
    const caret = el.selectionStart ?? 0;
    const next = `${value.slice(0, anchor)}${mentionToken(p.id, p.name)} ${value.slice(caret)}`;
    setValue(next);
    setAnchor(null);
    setTerm("");
    // put the caret after what we inserted, so typing continues naturally
    const pos = anchor + mentionToken(p.id, p.name).length + 1;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (anchor === null || matches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      // Enter picks the highlighted person INSTEAD of submitting the form —
      // the picker is open, so that is what Enter means right now
      e.preventDefault();
      insert(matches[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setAnchor(null);
    }
  };

  return (
    <span className="relative block">
      <textarea
        ref={ref}
        name={name}
        rows={rows}
        required={required}
        placeholder={placeholder}
        className={className}
        value={value}
        onChange={(e) => sync(e.currentTarget)}
        onClick={(e) => sync(e.currentTarget)}
        onKeyUp={(e) => sync(e.currentTarget)}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setAnchor(null), 150)} // let a click land first
      />
      {anchor !== null && (
        <ul className="absolute z-20 mt-1 max-h-60 w-72 overflow-auto rounded-md border border-border bg-card shadow-lg">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">לא נמצא אדם בשם ״{term}״</li>
          ) : (
            matches.map((p, i) => (
              <li key={p.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()} // keep focus so the caret survives
                  onClick={() => insert(p)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full flex-col items-start px-3 py-1.5 text-start text-sm ${
                    i === active ? "bg-brand-50" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="text-xs text-muted">{p.team}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </span>
  );
}
