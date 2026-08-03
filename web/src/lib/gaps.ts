import { addMonths } from "@/lib/dates";
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
  pointProgress: { pointEventId: string; doneOn: Date }[];
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
};

type Pointish = { label: string; offsetMonths: number; done: boolean; doneOn: Date | null };
type Metricish = {
  name: string;
  unit: string;
  checkpoints: { offsetMonths: number; target: number }[];
  value: number | null;
};

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
export function computePersonGaps(person: PersonForGaps, today: Date): { items: GapItem[]; status: GapLevel | null } {
  const plan = person.assignedPlan;
  if (!plan) return { items: [], status: null };

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
    const pt: Pointish = { label: e.label, offsetMonths: e.offsetMonths, done: !!prog, doneOn: prog?.doneOn ?? null };
    const level = levelForPoint({ dueDate: due, done: pt.done, doneOn: pt.doneOn }, today);
    items.push({
      kind: "point",
      label: e.label,
      dueDate: due,
      level,
      detail: pt.done ? "הושלם" : GAP_META[level].label,
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
    // A past-due occurrence with no filed content → 🔴.
    const overdue = offsets.filter((o) => !filled.has(o) && addMonths(rec, o).getTime() < today.getTime());
    if (overdue.length > 0) {
      items.push({
        kind: "recurring",
        label: r.label,
        dueDate: addMonths(rec, overdue[overdue.length - 1]),
        level: "OVERDUE",
        detail: `${overdue.length} מופעים טרם מולאו`,
      });
    } else {
      const next = offsets.find((o) => !filled.has(o) && addMonths(rec, o).getTime() >= today.getTime());
      if (next != null) {
        const due = addMonths(rec, next);
        const level = dueLevel(due, today);
        items.push({ kind: "recurring", label: r.label, dueDate: due, level, detail: GAP_META[level].label });
      } else if (offsets.length > 0) {
        items.push({ kind: "recurring", label: r.label, dueDate: addMonths(rec, offsets[offsets.length - 1]), level: "MET", detail: "כל המופעים מולאו" });
      }
    }
  }

  const status = items.reduce<GapLevel>((worst, it) => (SEVERITY[it.level] > SEVERITY[worst] ? it.level : worst), "MET");
  return { items, status };
}

export function worseOf(a: GapLevel, b: GapLevel): GapLevel {
  return SEVERITY[a] >= SEVERITY[b] ? a : b;
}
