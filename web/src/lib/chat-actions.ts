"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { executeChatJob } from "@/lib/agent";
import { runInBackground } from "@/lib/jobs";

/** Delete one of my chat questions (owner-only). A RUNNING one is simply dismissed. */
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
