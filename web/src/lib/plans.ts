import { prisma } from "@/lib/prisma";
import type { Visibility } from "@/lib/access";
import { formatYearsMonths, monthsAsWords } from "@/lib/years-months";

/** For each template, how many people within the user's scope are assigned a copy of it. */
export async function countAssignmentsByTemplate(visibility: Visibility): Promise<Map<string, number>> {
  const people = await prisma.person.findMany({
    where: { teamId: { in: [...visibility.nodeIds] }, assignedPlan: { isNot: null } },
    select: { assignedPlan: { select: { sourceTemplateId: true } } },
  });
  const counts = new Map<string, number>();
  for (const p of people) {
    const t = p.assignedPlan?.sourceTemplateId;
    if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return counts;
}

/**
 * For each template, how many people anywhere in the system hold a copy of it.
 *
 * Deliberately unclipped, unlike countAssignmentsByTemplate: this feeds the
 * delete confirmation, and a number narrowed to the admin's own scope would
 * understate who a deletion touches.
 */
export async function countAllAssignmentsByTemplate(): Promise<Map<string, number>> {
  const people = await prisma.person.findMany({
    where: { assignedPlan: { isNot: null } },
    select: { assignedPlan: { select: { sourceTemplateId: true } } },
  });
  const counts = new Map<string, number>();
  for (const p of people) {
    const t = p.assignedPlan?.sourceTemplateId;
    if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return counts;
}

/**
 * Default stop month offered for a new recurring event. A realistic service
 * span, chosen deliberately: the previous behaviour substituted a 36-month
 * preview constant when no stop was given, which silently became policy.
 */
export const DEFAULT_STOP_MONTHS = 72;

/**
 * Human label for a month offset relative to UNIT PLACEMENT, in the
 * years.months notation plus words — "הצבה +3.4 (3 שנים ו-4 חודשים)".
 */
export function formatOffset(months: number): string {
  if (months === 0) return "מרגע ההצבה";
  return `הצבה +${formatYearsMonths(months)} (${monthsAsWords(months)})`;
}

/**
 * Unroll a recurring event into occurrence offsets (months from placement):
 * start, start+interval, … up to and including the stop. The cap always comes
 * from the plan. A missing cap yields nothing rather than a default:
 * substituting a horizon here is what once turned a preview constant into the
 * rule the gap engine measured against, invisibly.
 */
export function unrollRecurring(
  intervalMonths: number,
  stopOffsetMonths: number | null,
  startOffsetMonths: number,
): number[] {
  if (intervalMonths <= 0 || stopOffsetMonths == null || startOffsetMonths < 0) return [];
  const out: number[] = [];
  for (let m = startOffsetMonths; m <= stopOffsetMonths; m += intervalMonths) out.push(m);
  return out;
}

export async function getPlans() {
  return prisma.careerPlan.findMany({
    where: { isTemplate: true }, // exclude per-person assigned copies
    orderBy: { name: "asc" },
    include: {
      _count: { select: { pointEvents: true, cumulativeMetrics: true, recurringEvents: true } },
    },
  });
}

export async function getPlan(id: string) {
  return prisma.careerPlan.findUnique({
    where: { id },
    include: {
      pointEvents: { orderBy: { offsetMonths: "asc" } },
      cumulativeMetrics: { include: { checkpoints: { orderBy: { offsetMonths: "asc" } } }, orderBy: { name: "asc" } },
      recurringEvents: { orderBy: { intervalMonths: "asc" } },
    },
  });
}

export type PlanWithEvents = NonNullable<Awaited<ReturnType<typeof getPlan>>>;
