"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { nextColorKey } from "@/lib/palette";
import { parseYearsMonths } from "@/lib/years-months";

function int(v: FormDataEntryValue | null, fallback = 0): number {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}
function num(v: FormDataEntryValue | null, fallback = 0): number {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : fallback;
}
function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

/**
 * A recruitment-anchored offset entered in the years.months notation, parsed
 * from the RAW string (`3.1` = one month, `3.10` = ten — the same float).
 * Throws the field's Hebrew error instead of storing a guess.
 */
function offsetOf(formData: FormData, field: string, what: string): number {
  const raw = str(formData.get(field));
  const months = parseYearsMonths(raw);
  if (months === null) {
    throw new Error(`${what}: יש להזין שנים.חודשים (למשל 3.4 = שלוש שנים וארבעה חודשים; החודשים 0–11).`);
  }
  return months;
}

export async function createPlan(formData: FormData) {
  await requireAdmin();
  const name = str(formData.get("name")) || "תכנית ללא שם";
  const plan = await prisma.careerPlan.create({ data: { name } });
  redirect(`/plans/${plan.id}`);
}

export async function renamePlan(formData: FormData) {
  await requireAdmin();
  const planId = str(formData.get("planId"));
  const name = str(formData.get("name"));
  if (!name) throw new Error("שם התכנית לא יכול להיות ריק.");
  await prisma.careerPlan.update({ where: { id: planId }, data: { name } });
  revalidatePath(`/plans/${planId}`);
  revalidatePath("/plans");
}

export async function copyPlan(formData: FormData) {
  await requireAdmin();
  const planId = str(formData.get("planId"));
  const src = await prisma.careerPlan.findUnique({
    where: { id: planId },
    include: {
      pointEvents: true,
      recurringEvents: true,
      cumulativeMetrics: { include: { checkpoints: true } },
    },
  });
  if (!src) throw new Error("תכנית לא נמצאה.");

  const copy = await prisma.careerPlan.create({
    data: {
      name: `${src.name} (עותק)`,
      pointEvents: { create: src.pointEvents.map((e) => ({ label: e.label, offsetMonths: e.offsetMonths })) },
      recurringEvents: {
        create: src.recurringEvents.map((r) => ({
          label: r.label,
          intervalMonths: r.intervalMonths,
          startOffsetMonths: r.startOffsetMonths,
          stopMode: "UNTIL_OFFSET",
          stopOffsetMonths: r.stopOffsetMonths,
          color: r.color,
        })),
      },
      cumulativeMetrics: {
        create: src.cumulativeMetrics.map((m) => ({
          name: m.name,
          unit: m.unit,
          color: m.color,
          checkpoints: { create: m.checkpoints.map((c) => ({ offsetMonths: c.offsetMonths, target: c.target })) },
        })),
      },
    },
  });
  redirect(`/plans/${copy.id}`);
}

export async function addPointEvent(formData: FormData) {
  await requireAdmin();
  const planId = str(formData.get("planId"));
  await prisma.pointEvent.create({
    data: { planId, label: str(formData.get("label")) || "אירוע", offsetMonths: offsetOf(formData, "offsetMonths", "מועד האירוע") },
  });
  revalidatePath(`/plans/${planId}`);
}

export async function addCumulativeMetric(formData: FormData) {
  await requireAdmin();
  const planId = str(formData.get("planId"));
  // each metric card gets its own soft colour, stable from creation onwards
  const existing = await prisma.cumulativeMetric.count({ where: { planId } });
  await prisma.cumulativeMetric.create({
    data: {
      planId,
      name: str(formData.get("name")) || "מדד",
      unit: str(formData.get("unit")) || "יחידות",
      color: nextColorKey(existing),
    },
  });
  revalidatePath(`/plans/${planId}`);
}

export async function addCheckpoint(formData: FormData) {
  await requireAdmin();
  const planId = str(formData.get("planId"));
  await prisma.metricCheckpoint.create({
    data: {
      metricId: str(formData.get("metricId")),
      offsetMonths: offsetOf(formData, "offsetMonths", "מועד היעד"),
      target: num(formData.get("target")),
    },
  });
  revalidatePath(`/plans/${planId}`);
}

/**
 * A recurring event always begins and stops at explicit offsets. "Until end of
 * service" is not an authoring option: that date is unknown for most people,
 * and a plan must schedule everyone assigned to it identically. The start is
 * equally explicit — the system never decides on the admin's behalf that the
 * cycle begins at recruitment.
 */
function recurringSpanFrom(formData: FormData): { startOffsetMonths: number; stopOffsetMonths: number } {
  const startOffsetMonths = offsetOf(formData, "startOffsetMonths", "תחילת האירוע");
  const stopOffsetMonths = offsetOf(formData, "stopOffsetMonths", "סיום האירוע");
  if (stopOffsetMonths <= 0) throw new Error("יש להזין עד מתי (שנים.חודשים מהגיוס) האירוע חוזר.");
  if (startOffsetMonths > stopOffsetMonths) throw new Error("תחילת האירוע חייבת להיות לפני מועד הסיום שלו.");
  return { startOffsetMonths, stopOffsetMonths };
}

export async function addRecurringEvent(formData: FormData) {
  await requireAdmin();
  const planId = str(formData.get("planId"));
  const span = recurringSpanFrom(formData);
  // each recurring event gets its own soft colour so its occurrences are
  // distinguishable from the other recurring events on the diagram
  const existing = await prisma.recurringEvent.count({ where: { planId } });
  await prisma.recurringEvent.create({
    data: {
      planId,
      label: str(formData.get("label")) || "אירוע מחזורי",
      intervalMonths: Math.max(1, int(formData.get("intervalMonths"), 6)),
      stopMode: "UNTIL_OFFSET",
      ...span,
      color: nextColorKey(existing),
    },
  });
  revalidatePath(`/plans/${planId}`);
}

/* --- editing existing plan items (colours stay put: they identify the item) --- */

export async function updatePointEvent(formData: FormData) {
  await requireAdmin();
  const planId = str(formData.get("planId"));
  const label = str(formData.get("label"));
  if (!label) throw new Error("שם האירוע לא יכול להיות ריק.");
  await prisma.pointEvent.update({
    where: { id: str(formData.get("id")) },
    data: { label, offsetMonths: offsetOf(formData, "offsetMonths", "מועד האירוע") },
  });
  revalidatePath(`/plans/${planId}`);
}

export async function updateCumulativeMetric(formData: FormData) {
  await requireAdmin();
  const planId = str(formData.get("planId"));
  const name = str(formData.get("name"));
  if (!name) throw new Error("שם המדד לא יכול להיות ריק.");
  await prisma.cumulativeMetric.update({
    where: { id: str(formData.get("id")) },
    data: { name, unit: str(formData.get("unit")) || "יחידות" },
  });
  revalidatePath(`/plans/${planId}`);
}

export async function updateCheckpoint(formData: FormData) {
  await requireAdmin();
  const planId = str(formData.get("planId"));
  await prisma.metricCheckpoint.update({
    where: { id: str(formData.get("id")) },
    data: { offsetMonths: offsetOf(formData, "offsetMonths", "מועד היעד"), target: num(formData.get("target")) },
  });
  revalidatePath(`/plans/${planId}`);
}

export async function updateRecurringEvent(formData: FormData) {
  await requireAdmin();
  const planId = str(formData.get("planId"));
  const label = str(formData.get("label"));
  if (!label) throw new Error("שם האירוע לא יכול להיות ריק.");
  await prisma.recurringEvent.update({
    where: { id: str(formData.get("id")) },
    data: {
      label,
      intervalMonths: Math.max(1, int(formData.get("intervalMonths"), 6)),
      stopMode: "UNTIL_OFFSET",
      ...recurringSpanFrom(formData),
    },
  });
  revalidatePath(`/plans/${planId}`);
}

type DeletableKind = "point" | "metric" | "recurring" | "checkpoint";

export async function deletePlanItem(formData: FormData) {
  await requireAdmin();
  const planId = str(formData.get("planId"));
  const kind = str(formData.get("kind")) as DeletableKind;
  const id = str(formData.get("id"));
  // deleteMany, deliberately: a double-click submits twice, and the second
  // delete finding nothing must be a no-op — not a P2025 crash page (observed
  // in the dev log, twice).
  switch (kind) {
    case "point":
      await prisma.pointEvent.deleteMany({ where: { id } });
      break;
    case "metric":
      await prisma.cumulativeMetric.deleteMany({ where: { id } });
      break;
    case "recurring":
      await prisma.recurringEvent.deleteMany({ where: { id } });
      break;
    case "checkpoint":
      await prisma.metricCheckpoint.deleteMany({ where: { id } });
      break;
  }
  revalidatePath(`/plans/${planId}`);
}

/**
 * Delete a plan template. Templates only — a person's copy belongs to an
 * assignment, and ending the assignment is how someone leaves a plan.
 *
 * The people holding copies of this template are not disturbed: their copy is
 * what they are measured against, `sourceTemplateId` is SetNull rather than
 * cascade, and `PlanAssignment.templateName` keeps the name readable. Verified
 * on the dev database: deleting a template with 4 copies left all 26 assigned
 * people holding their plan, changing only the link to the template.
 */
export async function removePlan(formData: FormData) {
  await requireAdmin();
  const planId = str(formData.get("planId"));
  const plan = await prisma.careerPlan.findUnique({
    where: { id: planId },
    select: { id: true, isTemplate: true },
  });
  if (!plan) throw new Error("תכנית לא נמצאה.");
  if (!plan.isTemplate) throw new Error("לא ניתן למחוק מסלול אישי של עובד — סיום השיוך הוא הדרך להוציא אדם ממסלול.");

  await prisma.careerPlan.delete({ where: { id: planId } });

  revalidatePath("/plans");
  revalidatePath("/people"); // the plan name there stops being a link
  revalidatePath("/", "layout");
}
