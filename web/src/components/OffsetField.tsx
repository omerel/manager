"use client";

import { useState } from "react";
import { formatYearsMonths, yearsMonthsWords } from "@/lib/years-months";

/**
 * An offset input in the years.months notation.
 *
 * A text field, deliberately not type="number": `3.1` (one month) and `3.10`
 * (ten months) are the same float, and a number input normalizes the value —
 * exactly the path that corrupts two-digit months. The raw string is what the
 * form posts and what the server parses. Feedback appears only when the input
 * is malformed; a valid value gets no caption (explicitly requested — the
 * readback text under every field read as clutter).
 */
export function OffsetField({
  name,
  field,
  label,
  defaultMonths,
  required,
}: {
  /** element id */
  name: string;
  /** posted form field name (defaults to `name`) */
  field?: string;
  label: string;
  defaultMonths?: number | null;
  required?: boolean;
}) {
  const initial = defaultMonths == null ? "" : formatYearsMonths(defaultMonths);
  const [raw, setRaw] = useState(initial);
  const words = raw.trim() === "" ? "" : yearsMonthsWords(raw);
  const invalid = raw.trim() !== "" && words === "";

  return (
    <div className="flex flex-col">
      <label htmlFor={name} className="mb-1 text-sm text-muted">
        {label}
      </label>
      <input
        id={name}
        name={field ?? name}
        type="text"
        inputMode="decimal"
        dir="ltr"
        placeholder="שנים.חודשים"
        defaultValue={initial}
        onChange={(e) => setRaw(e.target.value)}
        required={required}
        // native validation blocks a malformed value BEFORE submit — a server
        // throw in a plain form action is a dev error page, and the log showed
        // the admin hitting exactly that. The server-side parse stays as the
        // backstop; month part 0–11 only (single digit, 10 or 11).
        pattern="\d+(\.(1[01]|\d))?"
        title="שנים.חודשים — למשל 3.4; החודשים 0–11"
        className="w-32 rounded-md border border-border px-3 py-1.5 text-sm text-end"
      />
      {/* feedback only when the input is malformed — the user asked for no
          always-on readback under the field */}
      {invalid && <span className="mt-0.5 text-xs text-red-700">פורמט: שנים.חודשים (0–11)</span>}
    </div>
  );
}
