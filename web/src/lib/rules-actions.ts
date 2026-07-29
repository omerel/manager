"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { executeRule, pinRule, nextRunFrom } from "@/lib/rules-engine";
import type { RuleSchedule } from "@/generated/prisma/client";

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

function scheduleOf(v: FormDataEntryValue | null): RuleSchedule {
  const s = str(v);
  return s === "DAILY" || s === "WEEKLY" || s === "MONTHLY" ? (s as RuleSchedule) : "NONE";
}

/** Rules are private: every action resolves the rule through the owner's id. */
async function myRule(ruleId: string) {
  const me = await getSessionUser();
  const rule = await prisma.rule.findFirst({ where: { id: ruleId, userId: me.id } });
  if (!rule) throw new Error("חוק לא נמצא.");
  return { me, rule };
}

export async function createRule(formData: FormData) {
  const me = await getSessionUser();
  const name = str(formData.get("name"));
  const text = str(formData.get("text"));
  if (!name || !text) throw new Error("יש להזין שם וניסוח לחוק.");
  const schedule = scheduleOf(formData.get("schedule"));
  const rule = await prisma.rule.create({
    data: {
      userId: me.id,
      name,
      text,
      schedule,
      nextRunAt: schedule === "NONE" ? null : nextRunFrom(new Date(), schedule as "DAILY" | "WEEKLY" | "MONTHLY"),
    },
  });
  redirect(`/rules/${rule.id}`);
}

/** Edit name/text. Changing the TEXT of a pinned rule un-pins it — the stored
 *  realization and golden example were approved for the old wording. */
export async function updateRule(formData: FormData) {
  const { rule } = await myRule(str(formData.get("ruleId")));
  const name = str(formData.get("name"));
  const text = str(formData.get("text"));
  if (!name || !text) throw new Error("יש להזין שם וניסוח לחוק.");
  const textChanged = text !== rule.text;
  await prisma.rule.update({
    where: { id: rule.id },
    data: {
      name,
      text,
      ...(textChanged && rule.pinnedAt
        ? { pinnedAt: null, realizationKind: null, realization: null, goldenOutput: null }
        : {}),
    },
  });
  redirect(`/rules/${rule.id}${textChanged && rule.pinnedAt ? "?unpinned=1" : ""}`);
}

export async function updateRuleSchedule(formData: FormData) {
  const { rule } = await myRule(str(formData.get("ruleId")));
  const schedule = scheduleOf(formData.get("schedule"));
  await prisma.rule.update({
    where: { id: rule.id },
    data: {
      schedule,
      nextRunAt: schedule === "NONE" ? null : nextRunFrom(new Date(), schedule as "DAILY" | "WEEKLY" | "MONTHLY"),
    },
  });
  revalidatePath(`/rules/${rule.id}`);
}

export async function runRuleNow(formData: FormData) {
  const { me, rule } = await myRule(str(formData.get("ruleId")));
  const runId = await executeRule(me, rule); // synchronous — may take a minute
  redirect(`/rules/${rule.id}?run=${runId}`);
}

/** Pin: the approved run's output becomes the golden example; agent picks the realization. */
export async function pinRuleFromRun(formData: FormData) {
  const { me, rule } = await myRule(str(formData.get("ruleId")));
  const runId = str(formData.get("runId"));
  const run = await prisma.agentRun.findFirst({ where: { id: runId, ruleId: rule.id, status: "SUCCEEDED" } });
  if (!run?.output) throw new Error("אין תוצר מאושר לקבע.");
  await pinRule(me, rule, run.output); // synchronous meta-run
  redirect(`/rules/${rule.id}`);
}

export async function unpinRule(formData: FormData) {
  const { rule } = await myRule(str(formData.get("ruleId")));
  await prisma.rule.update({
    where: { id: rule.id },
    data: { pinnedAt: null, realizationKind: null, realization: null, goldenOutput: null },
  });
  revalidatePath(`/rules/${rule.id}`);
}

export async function deleteRule(formData: FormData) {
  const { rule } = await myRule(str(formData.get("ruleId")));
  await prisma.rule.delete({ where: { id: rule.id } }); // runs cascade
  redirect("/rules");
}

/** Bridge from chat (10.5): a useful question becomes a rule; its answer becomes the first run. */
export async function saveQuestionAsRule(formData: FormData) {
  const me = await getSessionUser();
  const runId = str(formData.get("runId"));
  const chatRun = await prisma.agentRun.findFirst({ where: { id: runId, userId: me.id, kind: "CHAT", status: "SUCCEEDED" } });
  if (!chatRun) throw new Error("ריצת צ'אט לא נמצאה.");
  const rule = await prisma.rule.create({
    data: { userId: me.id, name: chatRun.prompt.slice(0, 60), text: chatRun.prompt },
  });
  // copy the answer as the rule's first run — a candidate golden example for pinning
  await prisma.agentRun.create({
    data: {
      userId: me.id,
      kind: "RULE",
      ruleId: rule.id,
      prompt: chatRun.prompt,
      output: chatRun.output,
      status: "SUCCEEDED",
      durationMs: chatRun.durationMs,
    },
  });
  redirect(`/rules/${rule.id}`);
}
