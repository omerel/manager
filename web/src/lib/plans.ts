import { prisma } from "@/lib/prisma";
import type { RecurringStopMode } from "@/generated/prisma/client";
import type { Visibility } from "@/lib/access";

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

/** Human label for a month offset relative to recruitment. */
export function formatOffset(months: number): string {
  if (months === 0) return "מרגע הגיוס";
  return `גיוס +${months} ${months === 1 ? "חודש" : "חודשים"}`;
}

/**
 * Unroll a recurring event into occurrence offsets (months from recruitment).
 * UNTIL_OFFSET stops at the relative cap; END_OF_SERVICE has no template-level
 * bound, so a preview horizon is used (real per-person unrolling clips at the
 * person's end-of-service — a later phase).
 */
export function unrollRecurring(
  intervalMonths: number,
  stopMode: RecurringStopMode,
  stopOffsetMonths: number | null,
  previewHorizonMonths = 36,
): number[] {
  if (intervalMonths <= 0) return [];
  const cap = stopMode === "UNTIL_OFFSET" ? stopOffsetMonths ?? 0 : previewHorizonMonths;
  const out: number[] = [];
  for (let m = intervalMonths; m <= cap; m += intervalMonths) out.push(m);
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
