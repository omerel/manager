import Link from "next/link";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { computeVisibility } from "@/lib/access";
import { askQuestion, deleteChatRun } from "@/lib/chat-actions";
import { saveQuestionAsRule } from "@/lib/rules-actions";
import { fmtDate } from "@/lib/dates";
import { QuestionInput, type Mentionable } from "@/components/QuestionInput";
import { PendingButton } from "@/components/PendingButton";
import { AutoRefresh } from "@/components/AutoRefresh";
import { effectiveStatus, staleError } from "@/lib/jobs";

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ run?: string }> }) {
  const { run: runId } = await searchParams;
  const me = await getSessionUser();
  const visibility = await computeVisibility(me);

  // @-mention suggestions, clipped to the user's visibility.
  const [people, nodes] = await Promise.all([
    prisma.person.findMany({ where: { teamId: { in: [...visibility.nodeIds] } }, select: { fullName: true } }),
    prisma.orgNode.findMany({ where: { id: { in: [...visibility.nodeIds] } }, select: { name: true } }),
  ]);
  const mentionables: Mentionable[] = [
    ...people.map((p) => ({ label: p.fullName, kind: "person" as const })),
    ...nodes.map((n) => ({ label: n.name, kind: "org" as const })),
  ].sort((a, b) => a.label.localeCompare(b.label, "he"));

  // Only the owner sees their runs (rules page privacy applies to chat runs too).
  // Without ?run=, fall back to the latest question — navigating away must not "lose" it.
  const run = runId
    ? await prisma.agentRun.findFirst({ where: { id: runId, userId: me.id, kind: "CHAT" } })
    : await prisma.agentRun.findFirst({ where: { userId: me.id, kind: "CHAT" }, orderBy: { createdAt: "desc" } });
  const runStatus = run ? effectiveStatus(run) : null;

  // short history for jumping back to earlier answers
  const history = await prisma.agentRun.findMany({
    where: { userId: me.id, kind: "CHAT", ...(run ? { id: { not: run.id } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, prompt: true, createdAt: true, status: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">דף שאלות</h1>
        <p className="mt-1 text-muted">
          שאלות חופשיות על האנשים והקריירות שבראות שלך. כל שאלה עצמאית (ללא זיכרון-שיחה); התשובות כוללות ראיות.
        </p>
      </div>

      <form action={askQuestion} className="flex flex-wrap items-end gap-2 rounded-xl border border-border/70 bg-card shadow-sm p-4">
        <QuestionInput mentionables={mentionables} />
        <PendingButton
          pendingLabel="הסוכן חושב…"
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          שאל
        </PendingButton>
        <p className="w-full text-xs text-muted">
          הריצה עשויה לקחת עד דקה-שתיים. הסוכן קורא גם את תוכן הקבצים המצורפים לחוות הדעת.
        </p>
      </form>

      {run && (
        <div className="space-y-3">
          <div className="rounded-xl border border-border/70 bg-card shadow-sm p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
              <span>שאלה · {fmtDate(run.createdAt)}</span>
              <form action={deleteChatRun}>
                <input type="hidden" name="runId" value={run.id} />
                <button className="text-xs text-red-600 hover:underline">מחק שאלה</button>
              </form>
            </div>
            <p className="mt-1 whitespace-pre-wrap font-medium">{run.prompt}</p>
          </div>
          {runStatus === "SUCCEEDED" && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
                <span>תשובה{run.durationMs ? ` · ${Math.round(run.durationMs / 1000)} שניות` : ""} · חתוכה לראות שלך</span>
                <span className="flex items-center gap-2">
                  <a href={`/runs/${run.id}/download?format=md`} className="rounded-md border border-border bg-card px-2 py-1 text-xs hover:bg-slate-50">⬇ MD</a>
                  <a href={`/runs/${run.id}/download?format=pdf`} className="rounded-md border border-border bg-card px-2 py-1 text-xs hover:bg-slate-50">⬇ PDF</a>
                  <form action={saveQuestionAsRule}>
                    <input type="hidden" name="runId" value={run.id} />
                    <button className="rounded-md border border-border bg-card px-3 py-1 text-xs hover:bg-slate-50">
                      💾 שמור כחוק
                    </button>
                  </form>
                </span>
              </div>
              <div className="prose prose-sm max-w-none prose-headings:mt-4 prose-headings:mb-2 prose-p:my-1.5 prose-li:my-0.5 prose-table:text-sm">
                <Markdown remarkPlugins={[remarkGfm]}>{run.output ?? ""}</Markdown>
              </div>
            </div>
          )}
          {runStatus === "FAILED" && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              הריצה נכשלה: {staleError(run)}
            </div>
          )}
          {runStatus === "RUNNING" && (
            <div className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50/60 p-4 text-sm text-brand-800">
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              </svg>
              הסוכן חושב… התשובה תופיע כאן אוטומטית. אפשר לנווט לעמודים אחרים ולחזור.
              <AutoRefresh />
            </div>
          )}
        </div>
      )}

      {history.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted">שאלות קודמות</h2>
          <ul className="space-y-1">
            {history.map((h) => (
              <li key={h.id} className="flex items-center gap-2">
                <Link
                  href={`/chat?run=${h.id}`}
                  className="block min-w-0 flex-1 truncate rounded-md border border-border bg-card px-3 py-1.5 text-sm text-muted hover:bg-slate-50 hover:text-foreground"
                >
                  {h.status === "RUNNING" ? "⏳ " : ""}
                  {h.prompt} · <span className="text-xs">{fmtDate(h.createdAt)}</span>
                </Link>
                <form action={deleteChatRun}>
                  <input type="hidden" name="runId" value={h.id} />
                  <button className="text-xs text-red-600 hover:underline" title="מחק שאלה">
                    מחק
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
