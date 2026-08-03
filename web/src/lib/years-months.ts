/**
 * The years.months notation for placement-anchored offsets: the integer part
 * is years, the digits after the dot are months. `3.4` = 3 years and 4 months.
 *
 * The notation is positional, NOT decimal. `3.1` is one month and `3.10` is
 * ten — but as floats they are the same number, so any path that reads the
 * value numerically (`parseFloat`, `valueAsNumber`, a number input normalizing
 * on blur) silently turns ten months into one. Parse the raw string, always.
 *
 * Client-safe on purpose: the parsed-meaning echo renders in the browser.
 */

/** Months from a `Y.M` string, or null when malformed or months > 11. */
export function parseYearsMonths(raw: string): number | null {
  const s = raw.trim();
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const years = parseInt(m[1], 10);
  const months = m[2] === undefined ? 0 : parseInt(m[2], 10);
  if (months > 11) return null;
  return years * 12 + months;
}

/**
 * `40 → "3.4"`, `34 → "2.10"`, `36 → "3.0"`, `4 → "0.4"`.
 * The month digit is always written — a bare "6" could read as either unit,
 * and "6.0" cannot.
 */
export function formatYearsMonths(totalMonths: number): string {
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return `${years}.${months}`;
}

/** The notation spelled out: `40 → "3 שנים ו-4 חודשים"`. Empty string for bad input. */
export function yearsMonthsWords(raw: string): string {
  const total = parseYearsMonths(raw);
  if (total === null) return "";
  return monthsAsWords(total);
}

export function monthsAsWords(totalMonths: number): string {
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const y = years === 0 ? "" : years === 1 ? "שנה" : years === 2 ? "שנתיים" : `${years} שנים`;
  const m = months === 0 ? "" : months === 1 ? "חודש" : `${months} חודשים`;
  if (y && m) return `${y} ו-${m}`;
  if (y) return y;
  if (m) return m;
  return "מרגע ההצבה";
}
