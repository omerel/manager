/**
 * The watch rules, with no database behind them.
 *
 * Separate from `watch.ts` because the career-vector diagram colours a watched
 * item, and `plan-diagram.ts` is reachable from a client component: anything it
 * imports must not transitively reach `@/lib/prisma`. The pure rules live here;
 * the reads and writes live in `watch.ts`.
 */
import { occurrenceKey } from "@/lib/plan-diagram";

/** Default window: a month. Changed by an admin, never by a caller. */
export const WATCH_EXPIRY_DEFAULT_DAYS = 30;
export const WATCH_EXPIRY_KEY = "watchExpiryDays";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The key a watch is filed under, for each of the three item kinds.
 *
 * A point event and a metric are keyed by their own id; a recurring OCCURRENCE
 * is keyed by `occurrenceKey` — `id:offset` — because the watch is on one
 * occurrence, not on the event. Cuids carry no colon, so the three key spaces
 * cannot collide inside the single `WatchMark.itemKey` column.
 */
export const watchKey = {
  point: (pointEventId: string) => pointEventId,
  metric: (metricId: string) => metricId,
  occurrence: (recurringEventId: string, offsetMonths: number) =>
    occurrenceKey(recurringEventId, offsetMonths),
};

/** Whole days since the mark was placed — what the dashboard shows so an old watch is visible. */
export function watchAgeDays(markedAt: Date, today: Date): number {
  return Math.max(0, Math.floor((today.getTime() - markedAt.getTime()) / DAY_MS));
}

/**
 * Is this mark still in force?
 *
 * Computed at READ time from `markedAt`, never stored. That is the whole reason
 * expiry is not a column: an admin who widens the window must change what is
 * ALREADY marked, not only what gets marked next.
 *
 * Expiry returns an item to the gap it was — it can never close one. See
 * `design.md`: a false red costs a glance, a false green costs an obligation
 * nobody sees again.
 */
export function isWatchLive(markedAt: Date, expiryDays: number, today: Date): boolean {
  return watchAgeDays(markedAt, today) < expiryDays;
}
