import { prisma } from "@/lib/prisma";
import { addMonths, monthsBetween } from "@/lib/dates";
import type { RecurringStopMode } from "@/generated/prisma/client";

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
        },
      },
    },
  });
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
};
export type MetricRow = {
  id: string;
  name: string;
  unit: string;
  checkpoints: { offsetMonths: number; target: number; dueDate: Date }[];
  value: number | null;
  asOf: Date | null;
  note: string | null;
};
export type RecurrenceRow = {
  recurringEventId: string;
  label: string;
  offsetMonths: number;
  dueDate: Date;
  filledByEntryId: string | null;
};

/** Unroll a recurring event for a specific person, clipping at end-of-service. */
export function unrollForPerson(
  intervalMonths: number,
  stopMode: RecurringStopMode,
  stopOffsetMonths: number | null,
  recruitmentDate: Date,
  endOfServiceDate: Date | null,
  previewHorizonMonths = 36,
): number[] {
  if (intervalMonths <= 0) return [];
  let cap: number;
  if (stopMode === "UNTIL_OFFSET") {
    cap = stopOffsetMonths ?? 0;
  } else if (endOfServiceDate) {
    cap = monthsBetween(recruitmentDate, endOfServiceDate);
  } else {
    cap = previewHorizonMonths;
  }
  const out: number[] = [];
  for (let m = intervalMonths; m <= cap; m += intervalMonths) out.push(m);
  return out;
}

export function buildPersonTimeline(person: PersonFull) {
  const plan = person.assignedPlan;
  const rec = person.recruitmentDate;
  const doneByEvent = new Map(person.pointProgress.map((p) => [p.pointEventId, p]));
  const readingByMetric = new Map(person.metricReadings.map((r) => [r.metricId, r]));

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
    };
  });

  const metrics: MetricRow[] = (plan?.cumulativeMetrics ?? []).map((m) => {
    const reading = readingByMetric.get(m.id);
    return {
      id: m.id,
      name: m.name,
      unit: m.unit,
      checkpoints: m.checkpoints.map((c) => ({ offsetMonths: c.offsetMonths, target: c.target, dueDate: addMonths(rec, c.offsetMonths) })),
      value: reading?.value ?? null,
      asOf: reading?.asOf ?? null,
      note: reading?.note ?? null,
    };
  });

  const entryBySlot = new Map<string, string>();
  for (const e of person.evalEntries) {
    if (e.recurringEventId != null && e.occurrenceOffset != null) {
      entryBySlot.set(`${e.recurringEventId}:${e.occurrenceOffset}`, e.id);
    }
  }

  const recurrences: RecurrenceRow[] = (plan?.recurringEvents ?? []).flatMap((r) =>
    unrollForPerson(r.intervalMonths, r.stopMode, r.stopOffsetMonths, rec, person.endOfServiceDate).map((off) => ({
      recurringEventId: r.id,
      label: r.label,
      offsetMonths: off,
      dueDate: addMonths(rec, off),
      filledByEntryId: entryBySlot.get(`${r.id}:${off}`) ?? null,
    })),
  );

  return { points, metrics, recurrences };
}
