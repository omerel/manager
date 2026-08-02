/**
 * What deleting a person would destroy — the shape and the one predicate over
 * it. Client-safe on purpose: the confirmation modal is a client component, and
 * `people.ts` reaches prisma, so importing it there would pull the ORM into the
 * browser bundle. Same reason `org-kinds.ts` and `gap-meta.ts` exist.
 *
 * Card-field values are deliberately absent. They are ~9 for nearly every
 * person and are the person's card rather than their history — destroyed the
 * way a name or a photo is. Counting them would put the largest and least
 * meaningful number in front of the admin, in a dialog whose job is to convey
 * how much is at stake.
 */
export type DeletionImpact = {
  planAssignments: number; // also the number of per-person plan copies
  evalEntries: number;
  attachments: number;
  pointProgress: number;
  metricReadings: number;
  hasPhoto: boolean;
};

/** True when a deletion would take the person and nothing else. */
export function destroysNothingElse(i: DeletionImpact): boolean {
  return (
    i.planAssignments === 0 &&
    i.evalEntries === 0 &&
    i.attachments === 0 &&
    i.pointProgress === 0 &&
    i.metricReadings === 0 &&
    !i.hasPhoto
  );
}
