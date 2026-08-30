import { prisma } from "@/lib/prisma";
import {
  NO_WAIVERS,
  isCheckpointWaived,
  isOccurrenceWaived,
  isPointWaived,
  type WaiverContext,
  type WaiverOverride,
} from "@/lib/waivers";
import { addMonths, monthsBetween } from "@/lib/dates";
import { dueLevel, evalMetric, levelForPoint } from "@/lib/gaps";
import type { GapLevel } from "@/lib/gap-meta";
import type { VectorStatus } from "@/lib/plan-diagram";

export async function getPersonFull(id: string) {
  return prisma.person.findUnique({
    where: { id },
    include: {
      team: true,
      fieldValues: { include: { field: true }, orderBy: { order: "asc" } },
      pointProgress: true,
      metricReadings: true,
      evalEntries: { include: { attachments: true, recurringEvent: true }, orderBy: { createdAt: "desc" } },
      assignedPlan: {
        include: {
          // `source` is the TEMPLATE item this copy was made from; its guideline
          // is read through it at every open, so replacing the file on the
          // template reaches everyone already assigned
          pointEvents: {
            orderBy: { offsetMonths: "asc" },
            include: { source: { select: { guideName: true, guidePath: true } } },
          },
          cumulativeMetrics: { include: { checkpoints: { orderBy: { offsetMonths: "asc" } } }, orderBy: { name: "asc" } },
          recurringEvents: {
            orderBy: { intervalMonths: "asc" },
            include: { source: { select: { guideName: true, guidePath: true } } },
          },
          assignment: { include: { waivers: true, carryOvers: true } },
        },
      },
      // ended assignments: the person's history, never measured
      planAssignments: {
        where: { endedAt: { not: null } },
        orderBy: { assignedAt: "desc" },
        include: {
          carryOvers: true,
          plan: {
            include: {
              pointEvents: { orderBy: { offsetMonths: "asc" } },
              cumulativeMetrics: { include: { checkpoints: { orderBy: { offsetMonths: "asc" } } } },
              recurringEvents: { orderBy: { intervalMonths: "asc" } },
            },
          },
        },
      },
    },
  });
}

/** The waiver rule in force for this person's active assignment. */
export function waiverContextOf(person: {
  assignedPlan?: { assignment?: { waiverOffsetMonths: number; waivers: WaiverOverride[] } | null } | null;
}): WaiverContext {
  const a = person.assignedPlan?.assignment;
  if (!a) return NO_WAIVERS;
  return { line: a.waiverOffsetMonths, overrides: a.waivers };
}

export type PersonFull = NonNullable<Awaited<ReturnType<typeof getPersonFull>>>;

export type PointRow = {
  id: string;
  label: string;
  offsetMonths: number;
  dueDate: Date;
  done: boolean;
  doneOn: Date | null;
  note: string | null;
  /** predates the assignment (or overridden): shown, marked, never counted */
  waived: boolean;
  /** credited from a previous plan rather than done under this one */
  carriedFrom: string | null;
  /** added for this person alone, by a commander — not required by the track */
  personal: boolean;
  createdByName: string | null;
  /** «פורמטים והנחיות» from the template item, read live; null when there is none */
  guide: { name: string; href: string } | null;
};
export type MetricRow = {
  id: string;
  name: string;
  unit: string;
  /** `id` is the checkpoint's own — the career vector draws one card per checkpoint */
  checkpoints: { id: string; offsetMonths: number; target: number; dueDate: Date; waived: boolean }[];
  value: number | null;
  asOf: Date | null;
  note: string | null;
  carriedFrom: string | null;
};
export type RecurrenceRow = {
  recurringEventId: string;
  label: string;
  offsetMonths: number;
  dueDate: Date;
  filledByEntryId: string | null;
  waived: boolean;
  /** filling this occurrence offers the interview-style optional rating */
  withScore: boolean;
  /** the event's guideline — the same file at every occurrence */
  guide: { name: string; href: string } | null;
};

/**
 * Unroll a recurring event for a specific person, on the plan's own axis:
 * months from the person's UNIT PLACEMENT date.
 *
 * The plan's stop month decides the schedule — identically for everyone
 * assigned to it. A known end-of-service date then clips it, for every
 * recurring event: someone who has left should not keep accruing overdue
 * occurrences. That clip is a fact about the person, not an authoring choice.
 */
export function unrollForPerson(
  intervalMonths: number,
  stopOffsetMonths: number | null,
  startOffsetMonths: number,
  /** the plan's origin — unit placement, never recruitment */
  placementDate: Date,
  endOfServiceDate: Date | null,
): number[] {
  if (intervalMonths <= 0 || stopOffsetMonths == null || startOffsetMonths < 0) return [];
  const cap = endOfServiceDate
    ? Math.min(stopOffsetMonths, monthsBetween(placementDate, endOfServiceDate))
    : stopOffsetMonths;
  const out: number[] = [];
  for (let m = startOffsetMonths; m <= cap; m += intervalMonths) out.push(m);
  return out;
}

/**
 * The guideline to offer at one of this person's plan items.
 *
 * Resolved from the item's SOURCE — the template item — never from a copy of
 * the file, which is what keeps «the current document» current. The link points
 * at the person's own item id; the route follows the same pointer.
 */
function guideOf(
  kind: "point" | "recurring",
  item: { id: string; source?: { guideName: string | null; guidePath: string | null } | null },
): { name: string; href: string } | null {
  const g = item.source;
  if (!g?.guidePath || !g.guideName) return null;
  return { name: g.guideName, href: `/plan-guide/${kind}/${item.id}` };
}

export function buildPersonTimeline(person: PersonFull) {
  const plan = person.assignedPlan;
  // THE anchor. A plan describes a path in this unit, so every offset resolves
  // through the placement date; the recruitment date is history, not an origin.
  const rec = person.placementDate;
  const ctx = waiverContextOf(person);
  const doneByEvent = new Map(person.pointProgress.map((p) => [p.pointEventId, p]));
  const readingByMetric = new Map(person.metricReadings.map((r) => [r.metricId, r]));
  // provenance for anything credited from a previous plan
  const carried = plan?.assignment?.carryOvers ?? [];
  const carriedPoint = new Map(carried.filter((c) => c.toPointEventId).map((c) => [c.toPointEventId!, c.fromPlanName]));
  const carriedMetric = new Map(carried.filter((c) => c.toMetricId).map((c) => [c.toMetricId!, c.fromPlanName]));

  const points: PointRow[] = (plan?.pointEvents ?? []).map((e) => {
    const prog = doneByEvent.get(e.id);
    return {
      id: e.id,
      label: e.label,
      offsetMonths: e.offsetMonths,
      dueDate: addMonths(rec, e.offsetMonths),
      done: !!prog,
      doneOn: prog?.doneOn ?? null,
      note: prog?.note ?? null,
      waived: isPointWaived(ctx, e.id, e.offsetMonths),
      carriedFrom: carriedPoint.get(e.id) ?? null,
      personal: e.personal,
      createdByName: e.createdByName,
      guide: guideOf("point", e),
    };
  });

  const metrics: MetricRow[] = (plan?.cumulativeMetrics ?? []).map((m) => {
    const reading = readingByMetric.get(m.id);
    return {
      id: m.id,
      name: m.name,
      unit: m.unit,
      checkpoints: m.checkpoints.map((c) => ({
        id: c.id,
        offsetMonths: c.offsetMonths,
        target: c.target,
        dueDate: addMonths(rec, c.offsetMonths),
        waived: isCheckpointWaived(ctx, c.id, c.offsetMonths),
      })),
      value: reading?.value ?? null,
      asOf: reading?.asOf ?? null,
      note: reading?.note ?? null,
      carriedFrom: carriedMetric.get(m.id) ?? null,
    };
  });

  const entryBySlot = new Map<string, string>();
  for (const e of person.evalEntries) {
    if (e.recurringEventId != null && e.occurrenceOffset != null) {
      entryBySlot.set(`${e.recurringEventId}:${e.occurrenceOffset}`, e.id);
    }
  }

  const recurrences: RecurrenceRow[] = (plan?.recurringEvents ?? []).flatMap((r) =>
    unrollForPerson(r.intervalMonths, r.stopOffsetMonths, r.startOffsetMonths, rec, person.endOfServiceDate).map((off) => ({
      recurringEventId: r.id,
      label: r.label,
      offsetMonths: off,
      dueDate: addMonths(rec, off),
      filledByEntryId: entryBySlot.get(`${r.id}:${off}`) ?? null,
      waived: isOccurrenceWaived(ctx, r.id, off),
      withScore: r.withScore,
      guide: guideOf("recurring", r), // the same file at every occurrence
    })),
  );

  return { points, metrics, recurrences };
}

/**
 * The person's standing per plan item, keyed by the item's own id — what the
 * career vector on their card is coloured by.
 *
 * Every kind of item is included, not only point events: a drawing that marked
 * some cards and left the rest grey reads as a fault rather than as a picture.
 * A metric or a recurring event has many dated parts, so it takes the WORST
 * standing among the ones that count for this person — the drawing answers
 * "does this need me?", and the lists beneath it hold the detail.
 */
export function buildVectorStatus(
  timeline: ReturnType<typeof buildPersonTimeline>,
  placementDate: Date,
  today: Date,
): Map<string, VectorStatus> {
  const out = new Map<string, VectorStatus>();
  const rank: Record<VectorStatus, number> = { WAIVED: 0, MET: 1, APPROACHING: 2, OVERDUE: 3 };
  const worst = (a: VectorStatus | undefined, b: VectorStatus) => (!a || rank[b] > rank[a] ? b : a);
  const ofLevel = (l: GapLevel): VectorStatus => (l === "OVERDUE" ? "OVERDUE" : l === "APPROACHING" ? "APPROACHING" : "MET");

  for (const p of timeline.points) {
    out.set(p.id, p.waived ? "WAIVED" : ofLevel(levelForPoint({ dueDate: p.dueDate, done: p.done, doneOn: p.doneOn }, today)));
  }

  for (const m of timeline.metrics) {
    const live = m.checkpoints.filter((x) => !x.waived);
    // the metric is evaluated once, against the targets that still count for
    // this person; each of its cards then wears that verdict
    const level = live.length
      ? ofLevel(
          evalMetric(
            { name: m.name, unit: m.unit, checkpoints: live.map((x) => ({ offsetMonths: x.offsetMonths, target: x.target })), value: m.value },
            placementDate,
            today,
          ).level,
        )
      : "MET";
    for (const c of m.checkpoints) out.set(c.id, c.waived ? "WAIVED" : level);
  }

  for (const r of timeline.recurrences) {
    const status = r.waived
      ? "WAIVED"
      : r.filledByEntryId
        ? "MET"
        : r.dueDate.getTime() < today.getTime()
          ? "OVERDUE"
          : ofLevel(dueLevel(r.dueDate, today));
    // one card per recurring EVENT, so its occurrences fold into the worst one
    out.set(r.recurringEventId, worst(out.get(r.recurringEventId), status));
  }

  return out;
}
