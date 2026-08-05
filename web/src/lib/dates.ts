/** Add whole months to a date (UTC), the way plan offsets anchor to recruitment. */
export function addMonths(base: Date, months: number): Date {
  const d = new Date(base);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

/** Whole months from `base` to `target` (can be negative). */
export function monthsBetween(base: Date, target: Date): number {
  return (
    (target.getUTCFullYear() - base.getUTCFullYear()) * 12 +
    (target.getUTCMonth() - base.getUTCMonth())
  );
}

/**
 * Read a date the Israeli way, or not at all.
 *
 * Accepts `d/m/yyyy` (with / . or - as the separator) and ISO `yyyy-mm-dd`.
 * Nothing else, and there is deliberately NO month-first branch and NO fallback
 * to `new Date(string)` — a fallback is exactly how the American reading creeps
 * back in, and it creeps back on the ambiguous dates where it does damage:
 *
 *     new Date("03/08/2026")  →  2026-03-07T21:00:00Z
 *
 * Two faults at once there: the month is read first (3 August became 8 March),
 * and the slash form is parsed as LOCAL midnight and then stored as UTC, moving
 * it back another day. Building from Date.UTC avoids the second; refusing to
 * guess avoids the first.
 */
export function parseIsraeliDate(raw: string | null | undefined): Date | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;

  let y: number, m: number, d: number;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  const il = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(s);
  if (iso) {
    [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (il) {
    // day FIRST — the only reading
    [d, m, y] = [Number(il[1]), Number(il[2]), Number(il[3])];
  } else {
    return null;
  }

  const date = new Date(Date.UTC(y, m - 1, d));
  // round-trip the parts back, so 31/02/2026 is refused rather than rolling
  // silently into March
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date;
}

/**
 * Today as a day marker, in the same shape stored dates use: UTC midnight of
 * the calendar day.
 *
 * Built from the LOCAL calendar parts, not from `toISOString()`. The server
 * runs at UTC+3, so between midnight and 03:00 the UTC date is still
 * yesterday's — and a deadline compared that way would stay open for three
 * hours after it expired, every single night.
 */
export function todayMarker(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

/** `dd/mm/yyyy` — the form dates are entered and exported in. */
export function formatIsraeliDate(d: Date | null | undefined): string {
  if (!d) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

/** Long Hebrew form — for READING on cards and lists; cannot be misread either way. */
const dateFmt = new Intl.DateTimeFormat("he-IL", { year: "numeric", month: "long", day: "numeric" });
export function fmtDate(d: Date | null | undefined): string {
  return d ? dateFmt.format(d) : "—";
}

/** ISO `yyyy-mm-dd` — for machine interfaces (backup bundle, agent snapshot). */
export function toDateInput(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}
