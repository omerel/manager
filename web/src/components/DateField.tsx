"use client";

import { useEffect, useRef } from "react";
import { CalendarDays } from "lucide-react";
import { formatIsraeliDate, parseIsraeliDate } from "@/lib/dates";

/**
 * A date input in the Israeli format, with a native calendar picker.
 *
 * Two elements, and which one is which matters:
 *
 *  - The VISIBLE field is text, holding and submitting `dd/mm/yyyy`. It is the
 *    single source of truth. It is deliberately not <input type="date">,
 *    because that control *displays* whatever the operating system's locale
 *    dictates — on a machine set to US English it shows and accepts mm/dd/yyyy,
 *    which is the confusion this field exists to remove.
 *  - A hidden <input type="date"> exists ONLY to open the browser's own
 *    calendar. It carries no `name`, so it is never submitted and can never
 *    become a second answer to "what date is this".
 *
 * The first version of this field dropped the picker altogether and typing
 * eight digits was the price of one format everywhere. It is not a price worth
 * paying: showPicker() gives the real native calendar with no hand-written
 * calendar code, while the value the user reads and the form sends stay ours.
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
  const textRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);

  const initial =
    defaultDate instanceof Date
      ? formatIsraeliDate(defaultDate)
      : formatIsraeliDate(parseIsraeliDate(defaultDate ?? null));

  /** Open the native calendar, starting from whatever the text field holds. */
  const openPicker = () => {
    const picker = pickerRef.current;
    const text = textRef.current;
    if (!picker || !text) return;
    const current = parseIsraeliDate(text.value);
    // seed the picker so it opens on the month being edited, not on today
    picker.value = current ? current.toISOString().slice(0, 10) : "";
    // showPicker throws if the element is not user-activated or unsupported —
    // falling back to the text field is a working field, not a broken one
    try {
      picker.showPicker();
    } catch {
      text.focus();
    }
  };

  /**
   * The picker only ever writes INTO the text field, in our format.
   *
   * Wired as a native listener rather than React's onChange: React tracks the
   * last value it saw on an input and skips its synthetic handler when the
   * value was set programmatically, which is exactly what a picker does. A
   * plain addEventListener sees every change, however it arrived.
   */
  useEffect(() => {
    const picker = pickerRef.current;
    if (!picker) return;
    const onPicked = () => {
      const text = textRef.current;
      if (!text || !picker.value) return;
      const [y, m, d] = picker.value.split("-").map(Number);
      text.value = formatIsraeliDate(new Date(Date.UTC(y, m - 1, d)));
      text.dispatchEvent(new Event("input", { bubbles: true }));
    };
    picker.addEventListener("change", onPicked);
    picker.addEventListener("input", onPicked);
    return () => {
      picker.removeEventListener("change", onPicked);
      picker.removeEventListener("input", onPicked);
    };
  }, []);

  // Width classes belong on the WRAPPER, everything else on the input: the
  // wrapper is what the calendar button is positioned against, so if the two
  // have different widths the button lands away from the field it belongs to.
  const widths = (className ?? "").match(/(^|\s)w-\S+/g)?.join(" ").trim() ?? "";
  const rest = (className ?? "rounded-md border border-border px-3 py-1.5 text-sm text-end").replace(/(^|\s)w-\S+/g, "").trim();

  const field = (
    // `flex`, not `inline-flex`: inside the flex-column each field sits in, a
    // block-level wrapper stretches exactly as the bare input used to — an
    // inline wrapper collapsed to content width and left a gap beside it.
    // min-w-36 is the component's own floor: dd/mm/yyyy plus the calendar
    // button needs ~134px, and a caller passing w-32 clipped the leading zero.
    // Legibility of its own content is the field's responsibility, not each
    // call site's to remember.
    <span className={`relative flex min-w-36 items-center ${widths || "w-full"}`}>
      <input
        ref={textRef}
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
        // pl-9, not pe-8: the page is RTL but this input is dir="ltr", so the
        // logical properties on the two elements resolved to OPPOSITE sides and
        // the icon landed on top of the first digit. Physical sides only here.
        className={`${rest} w-full pl-9`}
      />
      <button
        type="button"
        onClick={openPicker}
        title="בחר תאריך מלוח שנה"
        aria-label="בחר תאריך מלוח שנה"
        className="absolute left-1.5 rounded p-1 text-muted hover:bg-brand-50 hover:text-brand-700"
      >
        <CalendarDays className="h-4 w-4" aria-hidden />
      </button>
      {/* no `name`: this exists only to summon the calendar, never to be submitted */}
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute left-2 h-0 w-0 opacity-0"
      />
    </span>
  );

  if (!label) return field;
  return (
    <div className="flex flex-col">
      <label htmlFor={name} className="mb-1 text-sm text-muted">
        {label}
      </label>
      {field}
    </div>
  );
}
