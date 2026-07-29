import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { computeVisibility } from "@/lib/access";
import { askQuestion } from "@/lib/chat-actions";
import { saveQuestionAsRule } from "@/lib/rules-actions";
import { fmtDate } from "@/lib/dates";
import { QuestionInput, type Mentionable } from "@/components/QuestionInput";
import { PendingButton } from "@/components/PendingButton";

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

  // Only the owner sees their run (rules page privacy applies to chat runs too).
  const run = runId ? await prisma.agentRun.findFirst({ where: { id: runId, userId: me.id, kind: "CHAT" } }) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">דף שאלות</h1>
        <p className="mt-1 text-muted">
          שאלות חופשיות על האנשים והקריירות שבראות שלך. כל שאלה עצמאית (ללא זיכרון-שיחה); התשובות כוללות ראיות.
        </p>
      </div>

      <form action={askQuestion} className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-4">
        <QuestionInput mentionables={mentionables} />
        <PendingButton
          pendingLabel="הסוכן חושב…"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          שאל
        </PendingButton>
        <p className="w-full text-xs text-muted">
          הריצה עשויה לקחת עד דקה-שתיים. הסוכן קורא גם את תוכן הקבצים המצורפים לחוות הדעת.
        </p>
      </form>

      {run && (
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-sm text-muted">שאלה · {fmtDate(run.createdAt)}</div>
            <p className="mt-1 whitespace-pre-wrap font-medium">{run.prompt}</p>
          </div>
          {run.status === "SUCCEEDED" && (
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
          {run.status === "FAILED" && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              הריצה נכשלה: {run.error}
            </div>
          )}
          {run.status === "RUNNING" && (
            <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted">הריצה עדיין פעילה — רענן/י בעוד רגע.</div>
          )}
        </div>
      )}
    </div>
  );
}
