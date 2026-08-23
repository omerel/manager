import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { createRule } from "@/lib/rules-actions";
import { ensureScheduler } from "@/lib/rules-engine";
import { fmtDate } from "@/lib/dates";
import { ActionForm } from "@/components/ActionForm";

const inputCls = "rounded-md border border-border px-3 py-1.5 text-sm";

export const SCHEDULE_LABEL: Record<string, string> = {
  NONE: "לפי דרישה",
  DAILY: "יומי",
  WEEKLY: "שבועי",
  MONTHLY: "חודשי",
};

export default async function RulesPage() {
  ensureScheduler(); // chronic runner (in-process)
  const me = await getSessionUser();
  const rules = await prisma.rule.findMany({
    where: { userId: me.id }, // private — each user sees only their own
    orderBy: { createdAt: "desc" },
    include: { runs: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">דף חוקים</h1>
        <p className="mt-1 text-muted">
          חוקים מילוליים שהסוכן מריץ עבורך — חד-פעמית או באופן כרוני. הדף פרטי: רק את/ה רואה אותו.
        </p>
      </div>

      <ActionForm action={createRule} className="space-y-3 rounded-xl border border-border/70 bg-card shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col">
            <label htmlFor="name" className="mb-1 text-sm text-muted">שם החוק</label>
            <input id="name" name="name" required placeholder="למשל: דוח פערים שבועי" className={inputCls} />
          </div>
          <div className="flex flex-col">
            <label htmlFor="schedule" className="mb-1 text-sm text-muted">תזמון</label>
            <select id="schedule" name="schedule" defaultValue="NONE" className={inputCls}>
              <option value="NONE">לפי דרישה</option>
              <option value="DAILY">יומי</option>
              <option value="WEEKLY">שבועי</option>
              <option value="MONTHLY">חודשי</option>
            </select>
          </div>
          <div className="flex flex-col justify-end">
            <label className="mb-1.5 flex items-center gap-2 text-sm">
              <input type="checkbox" name="emailOnRun" />
              שלח את התוצר למייל שלי בכל הרצה
            </label>
          </div>
        </div>
        <div className="flex flex-col">
          <label htmlFor="text" className="mb-1 text-sm text-muted">ניסוח החוק</label>
          <textarea
            id="text"
            name="text"
            rows={3}
            required
            placeholder='למשל: "הפק דוח של כל מי שבפיגור בתכנית הקריירה, מסודר לפי מסגרת, עם סיבת הפיגור והמלצה לפעולה."'
            className={inputCls}
          />
        </div>
        <button className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
          צור חוק
        </button>
      </ActionForm>

      {rules.length === 0 ? (
        <p className="text-muted">אין חוקים עדיין.</p>
      ) : (
        <ul className="space-y-3">
          {rules.map((r) => {
            const last = r.runs[0];
            return (
              <li key={r.id} className="rounded-xl border border-border/70 bg-card shadow-sm p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/rules/${r.id}`} className="font-semibold text-brand-700 hover:underline">
                    {r.name}
                  </Link>
                  <span className="flex items-center gap-2 text-xs">
                    <span className="rounded bg-slate-100 px-2 py-0.5">{SCHEDULE_LABEL[r.schedule]}</span>
                    {r.pinnedAt && (
                      <span className="rounded bg-brand-100 px-2 py-0.5 text-brand-800">
                        📌 מקובע · {r.realizationKind === "SCRIPT" ? "סקריפט" : "נוהל נעול"}
                      </span>
                    )}
                    {last && (
                      <span className={last.status === "SUCCEEDED" ? "text-emerald-700" : last.status === "FAILED" ? "text-red-600" : "text-muted"}>
                        ריצה אחרונה: {fmtDate(last.createdAt)} · {last.status === "SUCCEEDED" ? "הצליחה" : last.status === "FAILED" ? "נכשלה" : "רצה"}
                      </span>
                    )}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{r.text}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
