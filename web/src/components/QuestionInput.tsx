"use client";

import { useRef, useState } from "react";

export type Mentionable = { label: string; kind: "person" | "org" };

/**
 * Question textarea with @-mention autocomplete: typing "@" opens a list of
 * people/frameworks (already clipped to the user's visibility server-side);
 * picking one inserts the plain name.
 */
export function QuestionInput({ mentionables }: { mentionables: Mentionable[] }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [atPos, setAtPos] = useState<number | null>(null);
  const [active, setActive] = useState(0);

  const matches = open
    ? mentionables.filter((m) => m.label.includes(query.trim())).slice(0, 8)
    : [];

  function refresh(el: HTMLTextAreaElement) {
    const caret = el.selectionStart ?? 0;
    const before = el.value.slice(0, caret);
    const at = before.lastIndexOf("@");
    // an active mention = "@..." with no newline since the @, reasonably short
    if (at >= 0) {
      const token = before.slice(at + 1);
      if (!token.includes("\n") && token.length <= 30) {
        setAtPos(at);
        setQuery(token);
        setOpen(true);
        setActive(0);
        return;
      }
    }
    setOpen(false);
    setAtPos(null);
  }

  function pick(label: string) {
    const el = ref.current;
    if (!el || atPos === null) return;
    const caret = el.selectionStart ?? 0;
    el.value = el.value.slice(0, atPos) + label + " " + el.value.slice(caret);
    const newCaret = atPos + label.length + 1;
    el.setSelectionRange(newCaret, newCaret);
    el.focus();
    setOpen(false);
    setAtPos(null);
  }

  return (
    <div className="relative flex min-w-72 flex-1 flex-col">
      <label htmlFor="question" className="mb-1 text-sm text-muted">
        שאלה <span className="text-xs">(הקלד @ לאזכור איש או מסגרת)</span>
      </label>
      <textarea
        ref={ref}
        id="question"
        name="question"
        rows={2}
        required
        placeholder='למשל: "מי בפיגור כרגע ולמה?" · "@דנה כהן — מה מצב חוות הדעת?"'
        className="rounded-md border border-border px-3 py-2 text-sm"
        onInput={(e) => refresh(e.currentTarget)}
        onClick={(e) => refresh(e.currentTarget)}
        onKeyDown={(e) => {
          if (!open || matches.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % matches.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a - 1 + matches.length) % matches.length);
          } else if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            pick(matches[active].label);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && matches.length > 0 && (
        <ul className="absolute top-full z-10 mt-1 max-h-56 w-72 overflow-auto rounded-md border border-border bg-card shadow-lg">
          {matches.map((m, i) => (
            <li key={`${m.kind}:${m.label}`}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault(); // keep textarea focus
                  pick(m.label);
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-start text-sm hover:bg-slate-50 ${
                  i === active ? "bg-slate-100" : ""
                }`}
              >
                <span>{m.kind === "person" ? "👤" : "🏢"}</span>
                <span>{m.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
