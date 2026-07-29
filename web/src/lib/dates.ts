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

const dateFmt = new Intl.DateTimeFormat("he-IL", { year: "numeric", month: "long", day: "numeric" });
export function fmtDate(d: Date | null | undefined): string {
  return d ? dateFmt.format(d) : "—";
}

/** For <input type="date"> value (YYYY-MM-DD, UTC). */
export function toDateInput(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}
