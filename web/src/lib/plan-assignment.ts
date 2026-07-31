import { prisma } from "@/lib/prisma";
import { unrollRecurring } from "@/lib/plans";
import { monthsSince } from "@/lib/waivers";

/**
 * What the Admin reviews before a plan is assigned: which items would be waived
 * because they predate this moment, and what can be carried over from the plan
 * the person is leaving.
 *
 * Everything here is computed from the template, before any copy exists — the
 * copy is only created when the assignment is confirmed.
 */

export type PreviewItem = {
  /** template item id; mapped onto the copy's item once the copy is created */
  id: string;
  kind: "point" | "checkpoint" | "recurring";
  label: string;
  offsetMonths: number;
  /** for a recurring occurrence, which one */
  occurrenceOffset: number | null;
  waivedByDefault: boolean;
};

export type CarryCandidate = {
  kind: "METRIC" | "POINT";
  fromId: string;
  fromLabel: string;
  toId: string;
  toLabel: string;
  /** the accumulated value, or the completion date, being offered */
  value: number | null;
  originalDate: Date | null;
  detail: string;
};

export type AssignmentPreview = {
  personId: string;
  personName: string;
  templateId: string;
  templateName: string;
  tenureMonths: number;
  items: PreviewItem[];
  candidates: CarryCandidate[];
  previousPlanName: string | null;
  /** every item predates the assignment: legal, but it would measure nothing */
  measuresNothing: boolean;
};

const RECURRING_PREVIEW_CAP = 120;

export async function buildAssignmentPreview(
  personId: string,
  templateId: string,
  now = new Date(),
): Promise<AssignmentPreview | null> {
  const person = await prisma.person.findUnique({
    where: { id: personId },
    include: {
      pointProgress: true,
      metricReadings: true,
      assignedPlan: {
        include: {
          pointEvents: true,
          cumulativeMetrics: true,
        },
      },
    },
  });
  const tpl = await prisma.careerPlan.findUnique({
    where: { id: templateId },
    include: {
      pointEvents: { orderBy: { offsetMonths: "asc" } },
      cumulativeMetrics: { include: { checkpoints: { orderBy: { offsetMonths: "asc" } } }, orderBy: { name: "asc" } },
      recurringEvents: { orderBy: { intervalMonths: "asc" } },
    },
  });
  if (!person || !tpl || !tpl.isTemplate) return null;

  // the waiver line: where this person stands on their own timeline right now
  const tenureMonths = monthsSince(person.recruitmentDate, now);
  const waived = (offset: number) => offset <= tenureMonths;

  const items: PreviewItem[] = [
    ...tpl.pointEvents.map((e) => ({
      id: e.id,
      kind: "point" as const,
      label: e.label,
      offsetMonths: e.offsetMonths,
      occurrenceOffset: null,
      waivedByDefault: waived(e.offsetMonths),
    })),
    ...tpl.cumulativeMetrics.flatMap((m) =>
      m.checkpoints.map((c) => ({
        id: c.id,
        kind: "checkpoint" as const,
        label: `${m.name}: ${c.target} ${m.unit}`,
        offsetMonths: c.offsetMonths,
        occurrenceOffset: null,
        waivedByDefault: waived(c.offsetMonths),
      })),
    ),
    ...tpl.recurringEvents.flatMap((r) =>
      unrollRecurring(r.intervalMonths, r.stopOffsetMonths)
        .slice(0, RECURRING_PREVIEW_CAP)
        .map((off) => ({
          id: r.id,
          kind: "recurring" as const,
          label: r.label,
          offsetMonths: off,
          occurrenceOffset: off,
          waivedByDefault: waived(off),
        })),
    ),
  ].sort((a, b) => a.offsetMonths - b.offsetMonths);

  // Carry-over candidates from the plan being left. Offered, never pre-selected:
  // a wrong automatic match would grant credit nobody approved.
  const prev = person.assignedPlan;
  const candidates: CarryCandidate[] = [];
  if (prev) {
    const readingByMetric = new Map(person.metricReadings.map((r) => [r.metricId, r]));
    for (const oldM of prev.cumulativeMetrics) {
      const reading = readingByMetric.get(oldM.id);
      if (!reading) continue; // nothing accumulated, nothing to carry
      for (const newM of tpl.cumulativeMetrics) {
        if (newM.name === oldM.name && newM.unit === oldM.unit) {
          candidates.push({
            kind: "METRIC",
            fromId: oldM.id,
            fromLabel: `${oldM.name} (${oldM.unit})`,
            toId: newM.id,
            toLabel: `${newM.name} (${newM.unit})`,
            value: reading.value,
            originalDate: reading.asOf,
            detail: `${reading.value} ${oldM.unit}`,
          });
        }
      }
    }
    const doneByEvent = new Map(person.pointProgress.map((p) => [p.pointEventId, p]));
    for (const oldE of prev.pointEvents) {
      const prog = doneByEvent.get(oldE.id);
      if (!prog) continue; // only completed milestones can be carried
      for (const newE of tpl.pointEvents) {
        if (newE.label === oldE.label) {
          candidates.push({
            kind: "POINT",
            fromId: oldE.id,
            fromLabel: oldE.label,
            toId: newE.id,
            toLabel: newE.label,
            value: null,
            originalDate: prog.doneOn,
            detail: `בוצע ב-${prog.doneOn.toISOString().slice(0, 10)}`,
          });
        }
      }
    }
  }

  return {
    personId,
    personName: person.fullName,
    templateId,
    templateName: tpl.name,
    tenureMonths,
    items,
    candidates,
    previousPlanName: prev?.name ?? null,
    measuresNothing: items.length > 0 && items.every((i) => i.waivedByDefault),
  };
}
