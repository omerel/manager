import Link from "next/link";
import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { fmtDate } from "@/lib/dates";
import { runRuleNow, updateRule, updateRuleSchedule, pinRuleFromRun, unpinRule, deleteRule } from "@/lib/rules-actions";
import { PendingButton } from "@/components/PendingButton";

const proseCls = "prose prose-sm max-w-none prose-headings:mt-4 prose-headings:mb-2 prose-p:my-1.5 prose-li:my-0.5 prose-table:text-sm";

export default async function RuleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ run?: string; edit?: string; unpinned?: string }>;
}) {
  const { id } = await params;
  const { run: focusRunId, edit, unpinned } = await searchParams;
  const editing = edit === "1";
  const me = await getSessionUser();

  // private: only the owner can open a rule
  const rule = await prisma.rule.findFirst({
    where: { id, userId: me.id },
    include: { runs: { orderBy: { createdAt: "desc" }, take: 10 } },
  });
  if (!rule) notFound();

  const latestSuccess = rule.runs.find((r) => r.status === "SUCCEEDED");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/rules" className="text-sm text-muted hover:underline">← חזרה לדף החוקים</Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{rule.name}</h1>
          <div className="flex items-center gap-2">
            {!editing && (
              <>
                <form action={runRuleNow}>
                  <input type="hidden" name="ruleId" value={rule.id} />
                  <PendingButton
                    pendingLabel={rule.pinnedAt ? "מריץ (מקובע)…" : "הסוכן מריץ… עד דקה-שתיים"}
                    className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    ▶ הרץ עכשיו
                  </PendingButton>
                </form>
                <Link href={`/rules/${rule.id}?edit=1`} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-slate-50">
                  ✎ ערוך
                </Link>
                <form action={deleteRule}>
                  <input type="hidden" name="ruleId" value={rule.id} />
                  <button className="rounded-md border border-border px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">מחק חוק</button>
                </form>
              </>
            )}
          </div>
        </div>

        {unpinned === "1" && (
          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            נוסח החוק שונה — הקיבוע בוטל, כי המימוש ודוגמת-הזהב אושרו לנוסח הקודם. הרץ ואשר מחדש כדי לקבע.
          </div>
        )}

        {editing ? (
          <form action={updateRule} className="mt-2 space-y-2 rounded-md border border-blue-200 bg-blue-50/40 p-3">
            <input type="hidden" name="ruleId" value={rule.id} />
            <div className="flex flex-col">
              <label className="mb-1 text-sm text-muted">שם החוק</label>
              <input name="name" defaultValue={rule.name} required className="rounded-md border border-border px-3 py-1.5 text-sm" />
            </div>
            <div className="flex flex-col">
              <label className="mb-1 text-sm text-muted">ניסוח החוק</label>
              <textarea name="text" rows={4} required defaultValue={rule.text} className="rounded-md border border-border px-3 py-1.5 text-sm" />
            </div>
            {rule.pinnedAt && (
              <p className="text-xs text-amber-700">שים לב: שינוי הנוסח יבטל את הקיבוע הקיים (שינוי שם בלבד לא).</p>
            )}
            <div className="flex gap-2">
              <button className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700">שמור</button>
              <Link href={`/rules/${rule.id}`} className="rounded-md border border-border px-4 py-1.5 text-sm hover:bg-slate-50">ביטול</Link>
            </div>
          </form>
        ) : (
          <p className="mt-2 whitespace-pre-wrap rounded-md border border-border bg-card px-3 py-2 text-sm">{rule.text}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <form action={updateRuleSchedule} className="flex items-center gap-2">
            <input type="hidden" name="ruleId" value={rule.id} />
            <label className="text-muted">תזמון:</label>
            <select name="schedule" defaultValue={rule.schedule} className="rounded-md border border-border px-2 py-1 text-sm">
              <option value="NONE">לפי דרישה</option>
              <option value="DAILY">יומי</option>
              <option value="WEEKLY">שבועי</option>
              <option value="MONTHLY">חודשי</option>
            </select>
            <button className="rounded-md border border-border px-2 py-1 text-sm hover:bg-slate-50">עדכן</button>
          </form>
          {rule.nextRunAt && <span className="text-xs text-muted">ריצה כרונית הבאה: {fmtDate(rule.nextRunAt)}</span>}
        </div>
      </div>

      {/* Pin status */}
      {rule.pinnedAt ? (
        <section className="space-y-2 rounded-lg border border-indigo-200 bg-indigo-50/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-indigo-800">
              📌 מקובע לדטרמיניסטי · {rule.realizationKind === "SCRIPT" ? "סקריפט (ללא LLM, שחזור 1:1)" : "נוהל נעול (LLM עקבי לפי תבנית)"}
            </h2>
            <form action={unpinRule}>
              <input type="hidden" name="ruleId" value={rule.id} />
              <button className="text-xs text-red-600 hover:underline">בטל קיבוע</button>
            </form>
          </div>
          <p className="text-sm text-indigo-900/80">
            קובע {fmtDate(rule.pinnedAt)}. כל ריצה משחזרת את התוצר שאושר; הסוכן בחר את המימוש לפי אופי החוק.
          </p>
          <details className="text-sm">
            <summary className="cursor-pointer text-indigo-800">הצג מימוש</summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100" dir="ltr">{rule.realization}</pre>
          </details>
        </section>
      ) : (
        latestSuccess && (
          <section className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted">
              מרוצה מהתוצר האחרון? קיבוע יגרום לכל ריצה עתידית לשחזר אותו נאמנה — הסוכן יבחר לבד בין סקריפט דטרמיניסטי לנוהל נעול.
            </p>
            <form action={pinRuleFromRun}>
              <input type="hidden" name="ruleId" value={rule.id} />
              <input type="hidden" name="runId" value={latestSuccess.id} />
              <PendingButton
                pendingLabel="מקבע… הסוכן כותב מימוש (עד כמה דקות)"
                className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                📌 קבע כדטרמיניסטי
              </PendingButton>
            </form>
          </section>
        )
      )}

      {/* Results */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">תוצרים</h2>
        {rule.runs.length === 0 ? (
          <p className="text-muted">אין ריצות עדיין — לחץ ״הרץ עכשיו״.</p>
        ) : (
          rule.runs.map((run) => (
            <div
              key={run.id}
              className={`rounded-lg border p-4 ${
                run.id === focusRunId ? "border-blue-300 bg-blue-50/30" : "border-border bg-card"
              }`}
            >
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
                <span className="flex flex-wrap items-center gap-2">
                  <span>{fmtDate(run.createdAt)}</span>
                  {run.durationMs && <span>· {Math.round(run.durationMs / 1000)} שניות</span>}
                  {run.pinnedRun && <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-xs text-indigo-700">ריצה מקובעת</span>}
                  {run.status === "FAILED" && <span className="text-red-600">נכשלה</span>}
                  {run.status === "RUNNING" && <span>רצה…</span>}
                </span>
                {run.status === "SUCCEEDED" && (
                  <span className="flex items-center gap-2 text-xs">
                    <a href={`/runs/${run.id}/download?format=md`} className="rounded-md border border-border px-2 py-0.5 hover:bg-slate-50">⬇ MD</a>
                    <a href={`/runs/${run.id}/download?format=pdf`} className="rounded-md border border-border px-2 py-0.5 hover:bg-slate-50">⬇ PDF</a>
                  </span>
                )}
              </div>
              {run.status === "SUCCEEDED" && (
                <div className={proseCls}>
                  <Markdown remarkPlugins={[remarkGfm]}>{run.output ?? ""}</Markdown>
                </div>
              )}
              {run.status === "FAILED" && <p className="text-sm text-red-700">{run.error}</p>}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
