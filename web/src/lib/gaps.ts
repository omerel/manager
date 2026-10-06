import { addMonths } from "@/lib/dates";
// the watch key space for one occurrence, defined where the diagram defines it
import { occurrenceKey } from "@/lib/plan-diagram";
import { unrollForPerson } from "@/lib/person-view";
import {
  NO_WAIVERS,
  isCheckpointWaived,
  isOccurrenceWaived,
  isPointWaived,
  type WaiverContext,
  type WaiverOverride,
} from "@/lib/waivers";

/** Minimal shape needed to compute gaps (satisfied by the full person query). */
export type PersonForGaps = {
  /**
   * The plan's origin. Deliberately the ONLY date this type carries: a caller
   * that still has recruitment in hand has to notice it is not what the engine
   * asked for, which is how the anchor move was kept honest.
   */
  placementDate: Date;
  endOfServiceDate: Date | null;
  // `doneOn` is nullable: a row without one is an item under WATCH, not a
  // completion. The engine routes this through `isPointDone`.
  pointProgress: { pointEventId: string; doneOn: Date | null }[];
  metricReadings: { metricId: string; value: number; asOf: Date }[];
  evalEntries: { recurringEventId: string | null; occurrenceOffset: number | null }[];
  assignedPlan: {
    pointEvents: { id: string; label: string; offsetMonths: number }[];
    cumulativeMetrics: {
      id: string;
      name: string;
      unit: string;
      checkpoints: { id: string; offsetMonths: number; target: number }[];
    }[];
    recurringEvents: { id: string; label: string; intervalMonths: number; startOffsetMonths: number; stopOffsetMonths: number | null }[];
    /** the active assignment: its waiver line and any per-item overrides */
    assignment?: { waiverOffsetMonths: number; waivers: WaiverOverride[] } | null;
  } | null;
};

export { GAP_META, type GapLevel } from "@/lib/gap-meta";
import { GAP_META, type GapLevel } from "@/lib/gap-meta";

export const APPROACHING_DAYS = 30; // 🟡 window; grace period = 0 (task 0.6)
const DAY_MS = 24 * 60 * 60 * 1000;

const SEVERITY: Record<GapLevel, number> = { MET: 0, FUTURE: 1, APPROACHING: 2, OVERDUE: 3 };

/** Time-axis level for an unmet item due on `due`, relative to `today`. */
export function dueLevel(due: Date, today: Date): GapLevel {
  if (today.getTime() > due.getTime()) return "OVERDUE";
  const daysUntil = (due.getTime() - today.getTime()) / DAY_MS;
  return daysUntil <= APPROACHING_DAYS ? "APPROACHING" : "FUTURE";
}

export type GapItem = {
  kind: "point" | "metric" | "recurring";
  label: string;
  dueDate: Date;
  level: GapLevel;
  detail: string;
  /**
   * The item this gap came from, in the `WatchMark.itemKey` key space — the
   * point event's id, the metric's id, or `occurrenceKey` for one occurrence.
   * Lets a consumer line a gap up with its mark without re-deriving the key.
   */
  key: string;
  /**
   * ACKNOWLEDGED — a known gap, not a closed one.
   *
   * A flag beside `level`, deliberately not a fifth `GapLevel`: every existing
   * `Record<GapLevel, …>`, rollup and filter keeps working untouched, and a
   * watched item goes on being counted as the gap it is. The display vocabulary
   * grows; the measurement vocabulary does not.
   */
  watched: boolean;
  /** how long it has been under watch, so an old watch is visible and not merely extant */
  watchAgeDays: number | null;
};

/**
 * Watches in force for one person, keyed by `itemKey` — what `liveWatchesFor`
 * returns, narrowed to what the engine needs. An EMPTY map (the default) gives
 * byte-for-byte the behaviour that existed before this feature.
 */
export type WatchContext = ReadonlyMap<string, { ageDays: number; live: boolean }>;
export const NO_WATCHES: WatchContext = new Map();

type Pointish = { label: string; offsetMonths: number; done: boolean; doneOn: Date | null };
type Metricish = {
  name: string;
  unit: string;
  checkpoints: { offsetMonths: number; target: number }[];
  value: number | null;
};

/**
 * Has this point event been COMPLETED for this person?
 *
 * A `PointProgress` row used to mean exactly that, and every reader said so in
 * its own way — `!!prog`, a `_count`, a set of ids. Then the row grew a second
 * meaning: a row with no `doneOn` is an item under WATCH, carrying the note that
 * explains why, and completing nothing.
 *
 * The danger is that none of those readers would have failed to compile. `!!prog`
 * on a row whose `doneOn` is null is still true; a count is still a number. The
 * question "is it done?" therefore has exactly one answer in this codebase, and
 * `scripts/verify-gaps-under-watch.ts` sweeps for anyone asking it another way.
 */
export function isPointDone<T extends { doneOn: Date | null }>(
  prog: T | null | undefined,
): prog is T & { doneOn: Date } {
  return prog?.doneOn != null;
}

/** The counterpart: a row that exists but completes nothing is a watch. */
export function isPointWatched(prog: { doneOn: Date | null } | null | undefined): boolean {
  return prog != null && prog.doneOn == null;
}

export function levelForPoint(p: { dueDate: Date; done: boolean; doneOn: Date | null }, today: Date): GapLevel {
  if (p.done) return "MET";
  return dueLevel(p.dueDate, today);
}

/** Two-axis evaluation for a cumulative metric: the binding target is the most
 *  recent past-due checkpoint (or the next upcoming one if none is due yet). */
export function evalMetric(
  m: Metricish,
  placementDate: Date,
  today: Date,
): { level: GapLevel; detail: string; boundTarget: number | null; boundDue: Date | null } {
  const value = m.value ?? 0;
  const cps = [...m.checkpoints].sort((a, b) => a.offsetMonths - b.offsetMonths);
  if (cps.length === 0) return { level: "MET", detail: "אין יעדים", boundTarget: null, boundDue: null };

  const withDates = cps.map((c) => ({ ...c, due: addMonths(placementDate, c.offsetMonths) }));
  const pastDue = withDates.filter((c) => c.due.getTime() <= today.getTime());
  const bound = pastDue.length ? pastDue[pastDue.length - 1] : withDates[0];

  const detail =
    m.value === null ? `טרם נרשם · יעד ${bound.target} ${m.unit}` : `${value}/${bound.target} ${m.unit}`;

  if (value >= bound.target) return { level: "MET", detail, boundTarget: bound.target, boundDue: bound.due };
  // short of the binding target
  const level = pastDue.length ? "OVERDUE" : dueLevel(bound.due, today);
  return { level, detail, boundTarget: bound.target, boundDue: bound.due };
}

/** All gaps for a person + a rolled-up person status (null = no assigned plan). */
export function computePersonGaps(
  person: PersonForGaps,
  today: Date,
  /** Optional: absent means nothing is marked, which is exactly today's behaviour. */
  watches: WatchContext = NO_WATCHES,
): { items: GapItem[]; status: GapLevel | null } {
  const plan = person.assignedPlan;
  if (!plan) return { items: [], status: null };
  // The flag, never the level. `watchOf` decides only what is REPORTED about an
  // item, never what the item counts as.
  const watchOf = (key: string) => {
    const w = watches.get(key);
    return { key, watched: w?.live === true, watchAgeDays: w?.live ? w.ageDays : null };
  };

  const rec = person.placementDate;
  // Items that predate the assignment were never required of this person;
  // reporting them would be a wall of red for things nobody asked of them.
  const ctx: WaiverContext = plan.assignment
    ? { line: plan.assignment.waiverOffsetMonths, overrides: plan.assignment.waivers }
    : NO_WAIVERS;
  const doneByEvent = new Map(person.pointProgress.map((p) => [p.pointEventId, p]));
  const readingByMetric = new Map(person.metricReadings.map((r) => [r.metricId, r]));
  const items: GapItem[] = [];

  for (const e of plan.pointEvents) {
    if (isPointWaived(ctx, e.id, e.offsetMonths)) continue;
    const prog = doneByEvent.get(e.id);
    const due = addMonths(rec, e.offsetMonths);
    const pt: Pointish = { label: e.label, offsetMonths: e.offsetMonths, done: isPointDone(prog), doneOn: prog?.doneOn ?? null };
    const level = levelForPoint({ dueDate: due, done: pt.done, doneOn: pt.doneOn }, today);
    items.push({
      kind: "point",
      label: e.label,
      dueDate: due,
      level,
      detail: pt.done ? "הושלם" : GAP_META[level].label,
      ...watchOf(e.id),
    });
  }

  for (const m of plan.cumulativeMetrics) {
    const live = m.checkpoints.filter((c) => !isCheckpointWaived(ctx, c.id, c.offsetMonths));
    if (live.length === 0) continue; // every target predates the assignment
    const reading = readingByMetric.get(m.id);
    const ev = evalMetric(
      { name: m.name, unit: m.unit, checkpoints: live, value: reading?.value ?? null },
      rec,
      today,
    );
    items.push({
      kind: "metric",
      label: m.name,
      dueDate: ev.boundDue ?? rec,
      level: ev.level,
      detail: ev.detail,
      ...watchOf(m.id),
    });
  }

  // Offsets of filled occurrences, per recurring event.
  const filledByEvent = new Map<string, Set<number>>();
  for (const e of person.evalEntries) {
    if (e.recurringEventId != null && e.occurrenceOffset != null) {
      const set = filledByEvent.get(e.recurringEventId) ?? new Set<number>();
      set.add(e.occurrenceOffset);
      filledByEvent.set(e.recurringEventId, set);
    }
  }

  for (const r of plan.recurringEvents) {
    const offsets = unrollForPerson(r.intervalMonths, r.stopOffsetMonths, r.startOffsetMonths, rec, person.endOfServiceDate).filter(
      (off) => !isOccurrenceWaived(ctx, r.id, off),
    );
    const filled = filledByEvent.get(r.id) ?? new Set<number>();
    /**
     * Does this occurrence count as done?
     *
     * Normally: an `EvalEntry` exists for it. But a MARK overrides the entry —
     * the text was filed as a watch note, not as a summary, so the occurrence is
     * still owed. Clearing the mark is the declaration that the interview
     * happened; that makes completion an explicit act instead of an inference,
     * and ONLY for an occurrence someone marked.
     *
     * `watches.has` deliberately, not `.live`: an expired mark no longer reports
     * as watched, and still must not let the entry close the gap. Expiry returns
     * an occurrence to red, never to green.
     */
    const isFilled = (o: number) => filled.has(o) && !watches.has(occurrenceKey(r.id, o));
    // A past-due occurrence with no filed content → 🔴.
    const overdue = offsets.filter((o) => !isFilled(o) && addMonths(rec, o).getTime() < today.getTime());
    if (overdue.length > 0) {
      // The item stands for several occurrences; it reads as watched only when
      // EVERY overdue one is, so one acknowledged month cannot silence the rest.
      const last = overdue[overdue.length - 1];
      const allWatched = overdue.every((o) => watches.get(occurrenceKey(r.id, o))?.live === true);
      items.push({
        kind: "recurring",
        label: r.label,
        dueDate: addMonths(rec, last),
        level: "OVERDUE",
        detail: `${overdue.length} מופעים טרם מולאו`,
        key: occurrenceKey(r.id, last),
        watched: allWatched,
        watchAgeDays: allWatched ? (watches.get(occurrenceKey(r.id, last))?.ageDays ?? null) : null,
      });
    } else {
      const next = offsets.find((o) => !isFilled(o) && addMonths(rec, o).getTime() >= today.getTime());
      if (next != null) {
        const due = addMonths(rec, next);
        const level = dueLevel(due, today);
        items.push({
          kind: "recurring",
          label: r.label,
          dueDate: due,
          level,
          detail: GAP_META[level].label,
          ...watchOf(occurrenceKey(r.id, next)),
        });
      } else if (offsets.length > 0) {
        const last = offsets[offsets.length - 1];
        items.push({
          kind: "recurring",
          label: r.label,
          dueDate: addMonths(rec, last),
          level: "MET",
          detail: "כל המופעים מולאו",
          ...watchOf(occurrenceKey(r.id, last)),
        });
      }
    }
  }

  const status = items.reduce<GapLevel>((worst, it) => (SEVERITY[it.level] > SEVERITY[worst] ? it.level : worst), "MET");
  return { items, status };
}

export function worseOf(a: GapLevel, b: GapLevel): GapLevel {
  return SEVERITY[a] >= SEVERITY[b] ? a : b;
}
