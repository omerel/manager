/**
 * The five-point assessment on an interview summary.
 *
 * Defined once, and read by both the form and the list: a stored `3` means
 * nothing without its label, and two copies of the wording would drift apart
 * the way the card-schema texts once did.
 *
 * Client-safe on purpose — the select renders in the browser.
 */

export const EVAL_SCALE = [
  { value: 1, label: "אי הצלחה" },
  { value: 2, label: "מתחת למצופה" },
  { value: 3, label: "כמצופה" },
  { value: 4, label: "הצלחה מלאה" },
  { value: 5, label: "מעל המצופה" },
] as const;

export const MIN_SCORE = 1;
export const MAX_SCORE = 5;

/** True only for a whole number inside the scale. */
export function isValidScore(v: unknown): v is number {
  const n = Number(v);
  return Number.isInteger(n) && n >= MIN_SCORE && n <= MAX_SCORE;
}

/**
 * Parse a submitted score. `null` means "not rated" — an empty field, which is
 * a legitimate choice. `undefined` means the value was present and invalid, so
 * the caller must refuse it rather than store a guess: clamping a stray 7 to 5
 * would record "מעל המצופה" about a person, which nobody said.
 */
export function parseScore(raw: string | null | undefined): number | null | undefined {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  return isValidScore(s) ? Number(s) : undefined;
}

/** "4 · הצלחה מלאה" — a bare number is never displayed on its own. */
export function scoreLabel(score: number | null | undefined): string | null {
  if (score == null) return null;
  const hit = EVAL_SCALE.find((s) => s.value === score);
  return hit ? `${hit.value} · ${hit.label}` : String(score);
}
