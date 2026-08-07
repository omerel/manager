/**
 * The two action labels on an intake queue row.
 *
 * Stated once because they are read from two sides: the queue renders them, and
 * the verification suite clicks them by name. Written twice, they drifted — the
 * queue said "אישור — עובד חדש" while the check looked for "עובד חדש — לאישור",
 * and the suite failed for a wording reason while reporting a behaviour failure.
 *
 * Same reason `eval-scale.ts` exists, and the same drift the card-schema page
 * was fixed for.
 */

/** A run that produced a draft: a person who does not exist yet. */
export const INTAKE_NEW_PERSON_LABEL = "אישור — עובד חדש";

/** A run that matched an existing person: field proposals awaiting approval. */
export function intakeUpdateLabel(personName: string): string {
  return `אישור — עדכון ל${personName}`;
}
