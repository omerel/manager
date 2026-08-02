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
          pointEvents: { orderBy: { offsetMonths: "asc" } },
          cumulativeMetrics: { include: { checkpoints: { orderBy: { offsetMonths: "asc" } } }, orderBy: { name: "asc" } },
          recurringEvents: { orderBy: { intervalMonths: "asc" } },
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
};
export type MetricRow = {
  id: string;
  name: string;
  unit: string;
  checkpoints: { offsetMonths: number; target: number; dueDate: Date; waived: boolean }[];
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
};

/**
 * Unroll a recurring event for a specific person.
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
  recruitmentDate: Date,
  endOfServiceDate: Date | null,
): number[] {
  if (intervalMonths <= 0 || stopOffsetMonths == null || startOffsetMonths < 0) return [];
  const cap = endOfServiceDate
    ? Math.min(stopOffsetMonths, monthsBetween(recruitmentDate, endOfServiceDate))
    : stopOffsetMonths;
  const out: number[] = [];
  for (let m = startOffsetMonths; m <= cap; m += intervalMonths) out.push(m);
  return out;
}

export function buildPersonTimeline(person: PersonFull) {
  const plan = person.assignedPlan;
  const rec = person.recruitmentDate;
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
    };
  });

  const metrics: MetricRow[] = (plan?.cumulativeMetrics ?? []).map((m) => {
    const reading = readingByMetric.get(m.id);
    return {
      id: m.id,
      name: m.name,
      unit: m.unit,
      checkpoints: m.checkpoints.map((c) => ({
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
    })),
  );

  return { points, metrics, recurrences };
}
