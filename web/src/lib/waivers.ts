/**
 * Whether a plan item counts for a person.
 *
 * A person is assigned a plan at some point along their path, and the plan's
 * timeline is anchored to their UNIT PLACEMENT — so most of a plan handed to
 * someone long placed here sits in their past. Those items were never required of
 * them, and reporting them as overdue would be a wall of false red.
 *
 * The rule, in one place because gaps, the timeline view and the assignment
 * screen must all agree:
 *
 *     an item counts  ⟺  offsetMonths > waiverLine,  unless an override says otherwise
 *
 * The line is derived from the assignment date, never typed. Overrides are
 * stored only where they deviate from it, so the common case stores nothing.
 */

export type WaiverOverride = {
  pointEventId: string | null;
  checkpointId: string | null;
  recurringEventId: string | null;
  occurrenceOffset: number | null;
  waived: boolean;
};

export type WaiverContext = {
  /** months from unit placement at the moment of assignment; 0 = nothing waived */
  line: number;
  overrides: WaiverOverride[];
};

export const NO_WAIVERS: WaiverContext = { line: 0, overrides: [] };

/** An item is waived by the line alone when it falls at or before it. */
function beforeLine(offsetMonths: number, line: number): boolean {
  return offsetMonths <= line;
}

function overrideFor(
  ctx: WaiverContext,
  match: (o: WaiverOverride) => boolean,
): boolean | null {
  const hit = ctx.overrides.find(match);
  return hit ? hit.waived : null;
}

export function isPointWaived(ctx: WaiverContext, pointEventId: string, offsetMonths: number): boolean {
  return overrideFor(ctx, (o) => o.pointEventId === pointEventId) ?? beforeLine(offsetMonths, ctx.line);
}

export function isCheckpointWaived(ctx: WaiverContext, checkpointId: string, offsetMonths: number): boolean {
  return overrideFor(ctx, (o) => o.checkpointId === checkpointId) ?? beforeLine(offsetMonths, ctx.line);
}

/**
 * A recurring event can be overridden as a whole (no occurrenceOffset) or for a
 * single occurrence; the more specific override wins.
 */
export function isOccurrenceWaived(
  ctx: WaiverContext,
  recurringEventId: string,
  occurrenceOffset: number,
): boolean {
  const specific = overrideFor(
    ctx,
    (o) => o.recurringEventId === recurringEventId && o.occurrenceOffset === occurrenceOffset,
  );
  if (specific !== null) return specific;
  const whole = overrideFor(
    ctx,
    (o) => o.recurringEventId === recurringEventId && o.occurrenceOffset === null,
  );
  return whole ?? beforeLine(occurrenceOffset, ctx.line);
}

/** Whole months between an origin and a moment — how the waiver line is derived. */
export function monthsSince(origin: Date, at: Date): number {
  const months =
    (at.getUTCFullYear() - origin.getUTCFullYear()) * 12 +
    (at.getUTCMonth() - origin.getUTCMonth());
  return Math.max(0, at.getUTCDate() < origin.getUTCDate() ? months - 1 : months);
}
