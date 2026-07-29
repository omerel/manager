import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import type { AgentRun } from "@/generated/prisma/client";

// A RUNNING job older than this is considered dead (e.g. server restarted
// mid-run) — it reads as FAILED and stops blocking its target.
export const STALE_MS = 10 * 60 * 1000;

export type EffectiveStatus = "RUNNING" | "SUCCEEDED" | "FAILED";

/** Job status with stale-RUNNING mapped to FAILED (design D5). */
export function effectiveStatus(run: Pick<AgentRun, "status" | "createdAt">, now = Date.now()): EffectiveStatus {
  if (run.status === "RUNNING" && now - run.createdAt.getTime() > STALE_MS) return "FAILED";
  return run.status;
}

export function staleError(run: Pick<AgentRun, "status" | "createdAt" | "error">): string | null {
  if (run.status === "RUNNING" && effectiveStatus(run) === "FAILED") return "הריצה נקטעה (השרת הופעל מחדש). נסה שוב.";
  return run.error;
}

/** Is a live (non-stale) job RUNNING for this filter? Used by duplicate-run guards. */
export async function hasLiveRun(where: { ruleId?: string; personId?: string | null; userId?: string; kind?: string }): Promise<boolean> {
  const run = await prisma.agentRun.findFirst({
    where: { ...where, status: "RUNNING", createdAt: { gte: new Date(Date.now() - STALE_MS) } },
    select: { id: true },
  });
  return !!run;
}

/**
 * Create a RUNNING job row and schedule its work to run after the response is
 * sent (Next `after()`); the work updates the row on success/failure.
 */
export async function runInBackground(
  data: { userId: string; kind: string; prompt: string; ruleId?: string; personId?: string; pinnedRun?: boolean },
  work: (runId: string) => Promise<void>,
): Promise<string> {
  const run = await prisma.agentRun.create({ data: { ...data, status: "RUNNING" } });
  after(async () => {
    try {
      await work(run.id);
    } catch (e) {
      // last-resort: the work itself should update the row, but never leave it RUNNING
      await prisma.agentRun
        .update({
          where: { id: run.id },
          data: { status: "FAILED", error: e instanceof Error ? e.message.slice(0, 2000) : String(e) },
        })
        .catch(() => {});
    }
  });
  return run.id;
}
