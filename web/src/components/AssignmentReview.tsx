import Link from "next/link";
import { AlertTriangle, ArrowLeftRight, CalendarClock, Repeat2 } from "lucide-react";
import { assignPlan } from "@/lib/person-actions";
import type { AssignmentPreview } from "@/lib/plan-assignment";

/**
 * The review step before a plan is assigned. Two questions, deliberately
 * separated: what to ignore because it predates this person's assignment
 * (time), and what to bring across from the plan they are leaving (continuity).
 */
export function AssignmentReview({ preview, backHref }: { preview: AssignmentPreview; backHref: string }) {
  const { items, candidates, tenureMonths } = preview;
  const waivedCount = items.filter((i) => i.waivedByDefault).length;
  const refOf = (i: (typeof items)[number]) => `${i.kind}|${i.id}|${i.occurrenceOffset ?? ""}`;

  return (
    <section className="space-y-5 rounded-xl border border-brand-200 bg-brand-50/40 p-5 shadow-sm">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-brand-900">
          <ArrowLeftRight className="h-5 w-5 text-brand-600" aria-hidden />
          שיוך ״{preview.templateName}״ ל{preview.personName}
        </h2>
        <p className="mt-1 text-sm text-muted">
          ותק במעבר: <b>חודש {tenureMonths}</b> מההצבה ביחידה.
          {preview.previousPlanName ? ` מסלול נוכחי: ${preview.previousPlanName}.` : " זהו המסלול הראשון שלו."}
        </p>
      </div>

      {preview.measuresNothing && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            כל האירועים במסלול הזה מוקדמים מהוותק של העובד — אם לא תסמן משהו כנדרש,{" "}
            <b>לא יימדד אצלו דבר</b> והוא יופיע תקין בלי שנבדק כלום. אפשר בכל זאת לשייך.
          </span>
        </div>
      )}

      <form action={assignPlan} className="space-y-5">
        <input type="hidden" name="personId" value={preview.personId} />
        <input type="hidden" name="templateId" value={preview.templateId} />
        <input type="hidden" name="items" value={items.map(refOf).join(",")} />
        {preview.previousPlanName && <input type="hidden" name="previousPlanName" value={preview.previousPlanName} />}

        {/* ---- what gets ignored ---- */}
        <div>
          <h3 className="flex items-center gap-1.5 font-medium">
            <CalendarClock className="h-4 w-4 text-brand-600" aria-hidden />
            ממה מתעלמים
            <span className="text-xs font-normal text-muted">
              · ברירת מחדל: {waivedCount} מתוך {items.length} אירועים מוקדמים מחודש {tenureMonths}
            </span>
          </h3>
          <p className="mb-2 text-xs text-muted">
            אירוע מסומן ✓ נדרש ונמדד. אירוע לא מסומן מקבל פטור — הוא לא ייחשב פער, כי מעולם לא נדרש מהעובד.
          </p>
          <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-md border border-border bg-card">
            {items.map((i) => (
              <li key={refOf(i)} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                <input
                  type="checkbox"
                  name="require"
                  value={refOf(i)}
                  defaultChecked={!i.waivedByDefault}
                  id={`req-${refOf(i)}`}
                />
                <label htmlFor={`req-${refOf(i)}`} className="flex flex-1 flex-wrap items-center gap-2">
                  <span className="w-16 text-xs text-muted">חודש {i.offsetMonths}</span>
                  {i.kind === "recurring" && <Repeat2 className="h-3.5 w-3.5 text-muted" aria-hidden />}
                  <span className={i.waivedByDefault ? "text-muted" : "font-medium"}>{i.label}</span>
                  {i.waivedByDefault && (
                    <span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600">פטור</span>
                  )}
                </label>
              </li>
            ))}
          </ul>
        </div>

        {/* ---- what comes across ---- */}
        {candidates.length > 0 && (
          <div>
            <h3 className="font-medium">מה עובר מהמסלול הקודם</h3>
            <p className="mb-2 text-xs text-muted">
              אין סימון אוטומטי — התאמה שגויה הייתה מזכה את העובד בלי שאיש אישר. סמן/י את מה שבאמת אותו דבר.
            </p>
            <ul className="divide-y divide-border rounded-md border border-border bg-card">
              {candidates.map((c) => {
                const ref = `${c.kind}|${c.fromId}|${c.toId}`;
                return (
                  <li key={ref} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <input type="checkbox" name="carry" value={ref} id={`carry-${ref}`} />
                    <label htmlFor={`carry-${ref}`} className="flex flex-1 flex-wrap items-center gap-2">
                      <span className="font-medium">{c.fromLabel}</span>
                      <span className="text-muted">{c.detail}</span>
                      <span className="text-muted">←</span>
                      <span className="font-medium">{c.toLabel}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-1 flex-col">
            <label htmlFor="reason" className="mb-1 text-sm text-muted">
              סיבת המעבר (נשמרת בהיסטוריה)
            </label>
            <input
              id="reason"
              name="reason"
              placeholder="למשל: מעבר לתפקיד ניהולי"
              className="rounded-md border border-border px-3 py-1.5 text-sm"
            />
          </div>
          <button className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
            אשר שיוך
          </button>
          <Link href={backHref} className="rounded-md border border-border px-4 py-1.5 text-sm hover:bg-stone-50">
            ביטול
          </Link>
        </div>
      </form>
    </section>
  );
}
