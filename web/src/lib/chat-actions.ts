"use server";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { runChatQuestion } from "@/lib/agent";

export async function askQuestion(formData: FormData) {
  const question = String(formData.get("question") ?? "").trim();
  if (!question) throw new Error("יש להזין שאלה.");
  const user = await getSessionUser();
  const runId = await runChatQuestion(user, question); // synchronous run (may take a minute)
  redirect(`/chat?run=${runId}`);
}
