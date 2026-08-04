"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { executeChatJob } from "@/lib/agent";
import { runInBackground } from "@/lib/jobs";
import { sendReport } from "@/lib/emailer";

/** Delete one of my chat questions (owner-only). A RUNNING one is simply dismissed. */
export type EmailState = { ok?: boolean; message?: string };

/**
 * Email an answer to the user who asked it, and nobody else.
 *
 * Title and body are resolved exactly as the download route does, so an emailed
 * report and a downloaded one cannot differ — that equivalence is asserted in
 * verification rather than assumed.
 */
export async function emailRun(_prev: EmailState, formData: FormData): Promise<EmailState> {
  const me = await getSessionUser();
  const runId = String(formData.get("runId") ?? "").trim();
  // owner-only, the same clip the download route applies
  const run = await prisma.agentRun.findFirst({
    where: { id: runId, userId: me.id, status: "SUCCEEDED" },
    include: { rule: { select: { name: true } } },
  });
  if (!run?.output) return { ok: false, message: "לא נמצא תוצר לשליחה." };

  // the address lives on the User row, not on the session token
  const account = await prisma.user.findUniqueOrThrow({ where: { id: me.id }, select: { email: true } });
  const title = `${run.rule?.name ?? "תשובה"} · ${run.createdAt.toISOString().slice(0, 10)}`;
  const result = await sendReport({ title, body: run.output, to: account.email });
  return result.ok ? { ok: true, message: `נשלח ל-${account.email}` } : { ok: false, message: result.reason };
}

export async function deleteChatRun(formData: FormData) {
  const user = await getSessionUser();
  const runId = String(formData.get("runId") ?? "").trim();
  await prisma.agentRun.deleteMany({ where: { id: runId, userId: user.id, kind: "CHAT" } });
  redirect("/chat");
}

export async function askQuestion(formData: FormData) {
  const question = String(formData.get("question") ?? "").trim();
  if (!question) throw new Error("יש להזין שאלה.");
  const user = await getSessionUser();
  // returns immediately; the answer appears on the run page via auto-refresh
  const runId = await runInBackground(
    { userId: user.id, kind: "CHAT", prompt: question },
    (id) => executeChatJob(user, question, id),
  );
  redirect(`/chat?run=${runId}`);
}
