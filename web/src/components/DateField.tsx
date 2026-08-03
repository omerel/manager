"use client";

import { formatIsraeliDate, parseIsraeliDate } from "@/lib/dates";

/**
 * A date input in the Israeli format, drawn by the application.
 *
 * Deliberately NOT <input type="date">: that control submits ISO (safe) but
 * *displays* whatever the operating system's locale dictates, so on a machine
 * set to US English it shows and accepts mm/dd/yyyy — which is the exact
 * confusion this field exists to remove. A field the application draws is a
 * field the application can guarantee, on every browser and every machine.
 *
 * The cost, taken knowingly: no native calendar picker. `pattern` makes the
 * browser block a malformed value before it can be submitted, and the server
 * parses with the same strict reader either way.
 */
export function DateField({
  name,
  label,
  defaultDate,
  required,
  className,
}: {
  name: string;
  label?: string;
  defaultDate?: Date | string | null;
  required?: boolean;
  className?: string;
}) {
  const initial =
    defaultDate instanceof Date
      ? formatIsraeliDate(defaultDate)
      : formatIsraeliDate(parseIsraeliDate(defaultDate ?? null));

  const input = (
    <input
      id={name}
      name={name}
      type="text"
      inputMode="numeric"
      dir="ltr"
      placeholder="dd/mm/yyyy"
      defaultValue={initial}
      required={required}
      // day-first, two-digit month, four-digit year; blocks a malformed submit
      // natively so the server throw is a backstop, not the user's first signal
      pattern="(0?[1-9]|[12][0-9]|3[01])[/.\-](0?[1-9]|1[0-2])[/.\-]\d{4}"
      title="תאריך בפורמט dd/mm/yyyy — למשל 03/08/2026"
      className={className ?? "rounded-md border border-border px-3 py-1.5 text-sm text-end"}
    />
  );

  if (!label) return input;
  return (
    <div className="flex flex-col">
      <label htmlFor={name} className="mb-1 text-sm text-muted">
        {label}
      </label>
      {input}
    </div>
  );
}
