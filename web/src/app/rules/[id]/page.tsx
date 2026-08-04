import Link from "next/link";
import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { fmtDate } from "@/lib/dates";
import { runRuleNow, updateRule, updateRuleSchedule, pinRuleFromRun, unpinRule, deleteRule } from "@/lib/rules-actions";
import { PendingButton } from "@/components/PendingButton";
import { AutoRefresh } from "@/components/AutoRefresh";
import { effectiveStatus, staleError, STALE_MS } from "@/lib/jobs";

const proseCls = "prose prose-sm max-w-none prose-headings:mt-4 prose-headings:mb-2 prose-p:my-1.5 prose-li:my-0.5 prose-table:text-sm";

export default async function RuleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ run?: string; edit?: string; unpinned?: string; busy?: string }>;
}) {
  const { id } = await params;
  const { run: focusRunId, edit, unpinned, busy } = await searchParams;
  const editing = edit === "1";
  const me = await getSessionUser();

  // private: only the owner can open a rule
  const rule = await prisma.rule.findFirst({
    where: { id, userId: me.id },
    include: { runs: { orderBy: { createdAt: "desc" }, take: 10 } },
  });
  if (!rule) notFound();

  const ruleRuns = rule.runs.filter((r) => r.kind === "RULE");
  const latestSuccess = ruleRuns.find((r) => r.status === "SUCCEEDED");
  // a live (non-stale) job for this rule — blocks run/pin buttons
  const liveJob = rule.runs.find((r) => effectiveStatus(r) === "RUNNING");
  const pinning = liveJob?.kind === "PIN";
  const latestPin = rule.runs.find((r) => r.kind === "PIN");
  const pinFailed =
    !rule.pinnedAt && latestPin && effectiveStatus(latestPin) === "FAILED" && Date.now() - latestPin.createdAt.getTime() < STALE_MS;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/rules" className="text-sm text-muted hover:underline">← חזרה לדף החוקים</Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{rule.name}</h1>
          <div className="flex items-center gap-2">
            {!editing && (
              <>
                {liveJob ? (
                  <span className="rounded-md bg-slate-100 px-4 py-1.5 text-sm text-slate-500">
                    {pinning ? "קיבוע רץ…" : "ריצה פעילה…"}
                  </span>
                ) : (
                  <form action={runRuleNow}>
                    <input type="hidden" name="ruleId" value={rule.id} />
                    <PendingButton
                      pendingLabel="מתחיל…"
                      className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
                    >
                      ▶ הרץ עכשיו
                    </PendingButton>
                  </form>
                )}
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
        {busy === "1" && (
          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            כבר רצה פעולה עבור חוק זה — המתן לסיומה.
          </div>
        )}
        {pinFailed && (
          <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            הקיבוע נכשל: {staleError(latestPin!)} — אפשר לנסות שוב.
          </div>
        )}

        {editing ? (
          <form action={updateRule} className="mt-2 space-y-2 rounded-md border border-brand-200 bg-brand-50/60 p-3">
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
              <button className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700">שמור</button>
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
            <label className="flex items-center gap-1.5 text-sm text-muted">
              <input type="checkbox" name="emailOnRun" defaultChecked={rule.emailOnRun} />
              שלח למייל שלי בכל הרצה
            </label>
            <button className="rounded-md border border-border px-2 py-1 text-sm hover:bg-slate-50">עדכן</button>
          </form>
          {rule.nextRunAt && <span className="text-xs text-muted">ריצה כרונית הבאה: {fmtDate(rule.nextRunAt)}</span>}
        </div>
      </div>

      {/* Pin status */}
      {rule.pinnedAt ? (
        <section className="space-y-2 rounded-lg border border-brand-200 bg-brand-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-brand-900">
              📌 מקובע לדטרמיניסטי · {rule.realizationKind === "SCRIPT" ? "סקריפט (ללא LLM, שחזור 1:1)" : "נוהל נעול (LLM עקבי לפי תבנית)"}
            </h2>
            <form action={unpinRule}>
              <input type="hidden" name="ruleId" value={rule.id} />
              <button className="text-xs text-red-600 hover:underline">בטל קיבוע</button>
            </form>
          </div>
          <p className="text-sm text-brand-900/80">
            קובע {fmtDate(rule.pinnedAt)}. כל ריצה משחזרת את התוצר שאושר; הסוכן בחר את המימוש לפי אופי החוק.
          </p>
          <details className="text-sm">
            <summary className="cursor-pointer text-brand-900">הצג מימוש</summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100" dir="ltr">{rule.realization}</pre>
          </details>
        </section>
      ) : pinning ? (
        <section className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50/70 p-4 text-sm text-brand-900">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
            <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          </svg>
          מקבע… הסוכן כותב מימוש (עד כמה דקות). הדף יתעדכן לבד; אפשר לנווט ולחזור.
          <AutoRefresh />
        </section>
      ) : (
        latestSuccess &&
        !liveJob && (
          <section className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-card shadow-sm p-4">
            <p className="text-sm text-muted">
              מרוצה מהתוצר האחרון? קיבוע יגרום לכל ריצה עתידית לשחזר אותו נאמנה — הסוכן יבחר לבד בין סקריפט דטרמיניסטי לנוהל נעול.
            </p>
            <form action={pinRuleFromRun}>
              <input type="hidden" name="ruleId" value={rule.id} />
              <input type="hidden" name="runId" value={latestSuccess.id} />
              <PendingButton
                pendingLabel="מתחיל קיבוע…"
                className="rounded-md bg-brand-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-900"
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
        {ruleRuns.length === 0 ? (
          <p className="text-muted">אין ריצות עדיין — לחץ ״הרץ עכשיו״.</p>
        ) : (
          ruleRuns.map((run) => (
            <div
              key={run.id}
              className={`rounded-lg border p-4 ${
                run.id === focusRunId ? "border-blue-300 bg-brand-50/30" : "border-border bg-card"
              }`}
            >
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
                <span className="flex flex-wrap items-center gap-2">
                  <span>{fmtDate(run.createdAt)}</span>
                  {run.durationMs && <span>· {Math.round(run.durationMs / 1000)} שניות</span>}
                  {run.pinnedRun && <span className="rounded bg-brand-100 px-1.5 py-0.5 text-xs text-brand-800">ריצה מקובעת</span>}
                  {effectiveStatus(run) === "FAILED" && <span className="text-red-600">נכשלה</span>}
                  {effectiveStatus(run) === "RUNNING" && (
                    <span className="inline-flex items-center gap-1.5 text-brand-700">
                      <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                        <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                      </svg>
                      הסוכן מריץ… יתעדכן לבד
                      <AutoRefresh />
                    </span>
                  )}
                </span>
                {run.status === "SUCCEEDED" && (
                  <span className="flex items-center gap-2 text-xs">
                    <a href={`/runs/${run.id}/download?format=md`} className="rounded-md border border-border px-2 py-0.5 hover:bg-slate-50">⬇ MD</a>
                    <a href={`/runs/${run.id}/download?format=pdf`} className="rounded-md border border-border px-2 py-0.5 hover:bg-slate-50">⬇ PDF</a>
                  </span>
                )}
              </div>
              {effectiveStatus(run) === "SUCCEEDED" && (
                <div className={proseCls}>
                  <Markdown remarkPlugins={[remarkGfm]}>{run.output ?? ""}</Markdown>
                </div>
              )}
              {effectiveStatus(run) === "FAILED" && <p className="text-sm text-red-700">{staleError(run)}</p>}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
