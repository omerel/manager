"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import type { RecurringStopMode } from "@/generated/prisma/client";

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
          stopMode: r.stopMode,
          stopOffsetMonths: r.stopOffsetMonths,
        })),
      },
      cumulativeMetrics: {
        create: src.cumulativeMetrics.map((m) => ({
          name: m.name,
          unit: m.unit,
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
    data: { planId, label: str(formData.get("label")) || "אירוע", offsetMonths: int(formData.get("offsetMonths")) },
  });
  revalidatePath(`/plans/${planId}`);
}

export async function addCumulativeMetric(formData: FormData) {
  await requireAdmin();
  const planId = str(formData.get("planId"));
  await prisma.cumulativeMetric.create({
    data: { planId, name: str(formData.get("name")) || "מדד", unit: str(formData.get("unit")) || "יחידות" },
  });
  revalidatePath(`/plans/${planId}`);
}

export async function addCheckpoint(formData: FormData) {
  await requireAdmin();
  const planId = str(formData.get("planId"));
  await prisma.metricCheckpoint.create({
    data: {
      metricId: str(formData.get("metricId")),
      offsetMonths: int(formData.get("offsetMonths")),
      target: num(formData.get("target")),
    },
  });
  revalidatePath(`/plans/${planId}`);
}

export async function addRecurringEvent(formData: FormData) {
  await requireAdmin();
  const planId = str(formData.get("planId"));
  const stopMode = str(formData.get("stopMode")) as RecurringStopMode;
  const stopOffsetMonths = stopMode === "UNTIL_OFFSET" ? int(formData.get("stopOffsetMonths")) : null;
  await prisma.recurringEvent.create({
    data: {
      planId,
      label: str(formData.get("label")) || "אירוע כרוני",
      intervalMonths: Math.max(1, int(formData.get("intervalMonths"), 6)),
      stopMode: stopMode === "UNTIL_OFFSET" ? "UNTIL_OFFSET" : "END_OF_SERVICE",
      stopOffsetMonths,
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
  switch (kind) {
    case "point":
      await prisma.pointEvent.delete({ where: { id } });
      break;
    case "metric":
      await prisma.cumulativeMetric.delete({ where: { id } });
      break;
    case "recurring":
      await prisma.recurringEvent.delete({ where: { id } });
      break;
    case "checkpoint":
      await prisma.metricCheckpoint.delete({ where: { id } });
      break;
  }
  revalidatePath(`/plans/${planId}`);
}
