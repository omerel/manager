import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlan, formatOffset, unrollRecurring, type PlanWithEvents } from "@/lib/plans";
import { buildPlanDiagramSvg } from "@/lib/plan-diagram";
import { Route, FileDown } from "lucide-react";
import { isAdmin } from "@/lib/authz";
import {
  addPointEvent,
  addCumulativeMetric,
  addCheckpoint,
  addRecurringEvent,
  copyPlan,
  renamePlan,
  deletePlanItem,
} from "@/lib/plan-actions";

const RECURRING_PREVIEW_HORIZON = 36;

export default async function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [plan, admin] = await Promise.all([getPlan(id), isAdmin()]);
  if (!plan) notFound();

  return (
    <div className="space-y-8">
      <div>
        <Link href="/plans" className="text-sm text-muted hover:underline">
          ← חזרה לתכניות
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          {admin ? (
            <form action={renamePlan} className="flex items-center gap-2">
              <input type="hidden" name="planId" value={plan.id} />
              <input
                name="name"
                defaultValue={plan.name}
                aria-label="שם התכנית"
                className="rounded-md border border-border px-3 py-1.5 text-xl font-bold"
              />
              <button className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-slate-50">שמור שם</button>
            </form>
          ) : (
            <h1 className="text-2xl font-bold">{plan.name}</h1>
          )}
          {admin && (
            <form action={copyPlan}>
              <input type="hidden" name="planId" value={plan.id} />
              <button className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-slate-50">שכפל תכנית</button>
            </form>
          )}
        </div>
        <p className="mt-1 text-muted">
          כל העיתויים יחסיים לתאריך הגיוס של האיש שהתכנית תשויך אליו. שכפול יוצר עותק בשם ״(עותק)״ — ניתן לשנות את השם כאן.
        </p>
      </div>

      <Timeline plan={plan} />

      <PointEventsSection plan={plan} admin={admin} />
      <CumulativeSection plan={plan} admin={admin} />
      <RecurringSection plan={plan} admin={admin} />
    </div>
  );
}

/* --- Career-path diagram (upward arrow, shared SVG builder) --- */
function Timeline({ plan }: { plan: PlanWithEvents }) {
  const hasEvents =
    plan.pointEvents.length > 0 || plan.recurringEvents.length > 0 ||
    plan.cumulativeMetrics.some((m) => m.checkpoints.length > 0);

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-brand-900">
          <Route className="h-5 w-5 text-brand-600" aria-hidden />
          מסלול הקריירה
        </h2>
        {hasEvents && (
          <a
            href={`/plans/${plan.id}/diagram?format=pdf`}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-stone-50"
          >
            <FileDown className="h-4 w-4 text-brand-600" aria-hidden />
            הפק PDF למצגת
          </a>
        )}
      </div>
      {!hasEvents ? (
        <p className="text-muted">אין עדיין אירועים בתכנית — הוסף אירועים למטה והמסלול יצויר כאן.</p>
      ) : (
        <div
          className="overflow-hidden rounded-xl border border-border/70 bg-card p-2 shadow-sm"
          dangerouslySetInnerHTML={{ __html: buildPlanDiagramSvg(plan) }}
        />
      )}
    </section>
  );
}

function DeleteButton({ planId, kind, id }: { planId: string; kind: string; id: string }) {
  return (
    <form action={deletePlanItem}>
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <button className="text-xs text-red-600 hover:underline" title="מחק">
        מחק
      </button>
    </form>
  );
}

/* --- Point events --- */
function PointEventsSection({ plan, admin }: { plan: PlanWithEvents; admin: boolean }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">● אירועים נקודתיים</h2>
      {plan.pointEvents.length === 0 ? (
        <p className="text-sm text-muted">אין אירועים נקודתיים.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border/70 bg-card shadow-sm">
          {plan.pointEvents.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2">
              <span>
                <span className="font-medium">{e.label}</span>{" "}
                <span className="text-sm text-muted">· {formatOffset(e.offsetMonths)}</span>
              </span>
              {admin && <DeleteButton planId={plan.id} kind="point" id={e.id} />}
            </li>
          ))}
        </ul>
      )}
      {admin && (
        <form action={addPointEvent} className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border p-3">
          <input type="hidden" name="planId" value={plan.id} />
          <TextField name="label" label="שם האירוע" placeholder="סיום הכשרה בסיסית" />
          <NumField name="offsetMonths" label="חודשים מהגיוס" defaultValue={1} />
          <AddButton>הוסף נקודתי</AddButton>
        </form>
      )}
    </section>
  );
}

/* --- Cumulative metrics --- */
function CumulativeSection({ plan, admin }: { plan: PlanWithEvents; admin: boolean }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">📈 אירועים מצטברים (מדדים)</h2>
      {plan.cumulativeMetrics.length === 0 ? (
        <p className="text-sm text-muted">אין מדדים מצטברים.</p>
      ) : (
        <div className="space-y-3">
          {plan.cumulativeMetrics.map((m) => (
            <div key={m.id} className="rounded-xl border border-border/70 bg-card shadow-sm p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {m.name} <span className="text-sm text-muted">({m.unit})</span>
                </span>
                {admin && <DeleteButton planId={plan.id} kind="metric" id={m.id} />}
              </div>
              {m.checkpoints.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {m.checkpoints.map((c) => (
                    <li key={c.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-sm">
                      <span>
                        {c.target} {m.unit} עד {formatOffset(c.offsetMonths)}
                      </span>
                      {admin && <DeleteButton planId={plan.id} kind="checkpoint" id={c.id} />}
                    </li>
                  ))}
                </ul>
              )}
              {admin && (
                <form action={addCheckpoint} className="mt-3 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="planId" value={plan.id} />
                  <input type="hidden" name="metricId" value={m.id} />
                  <NumField name="target" label={`יעד (${m.unit})`} defaultValue={100} step="any" />
                  <NumField name="offsetMonths" label="חודשים מהגיוס" defaultValue={6} />
                  <AddButton>הוסף יעד-ביניים</AddButton>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
      {admin && (
        <form action={addCumulativeMetric} className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border p-3">
          <input type="hidden" name="planId" value={plan.id} />
          <TextField name="name" label="שם המדד" placeholder="שעות גמול" />
          <TextField name="unit" label="יחידה" placeholder="שעות" />
          <AddButton>הוסף מדד</AddButton>
        </form>
      )}
    </section>
  );
}

/* --- Recurring events --- */
function RecurringSection({ plan, admin }: { plan: PlanWithEvents; admin: boolean }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">🔁 אירועים כרוניים</h2>
      {plan.recurringEvents.length === 0 ? (
        <p className="text-sm text-muted">אין אירועים כרוניים.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border/70 bg-card shadow-sm">
          {plan.recurringEvents.map((r) => {
            const stop =
              r.stopMode === "UNTIL_OFFSET" ? `עד ${formatOffset(r.stopOffsetMonths ?? 0)}` : "עד סוף השירות";
            const preview = unrollRecurring(r.intervalMonths, r.stopMode, r.stopOffsetMonths, RECURRING_PREVIEW_HORIZON);
            return (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <span>
                  <span className="font-medium">{r.label}</span>{" "}
                  <span className="text-sm text-muted">
                    · כל {r.intervalMonths} חודשים · {stop} · מופעים: {preview.map((o) => `+${o}`).join(", ") || "—"}
                  </span>
                </span>
                {admin && <DeleteButton planId={plan.id} kind="recurring" id={r.id} />}
              </li>
            );
          })}
        </ul>
      )}
      {admin && (
        <form action={addRecurringEvent} className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border p-3">
          <input type="hidden" name="planId" value={plan.id} />
          <TextField name="label" label="שם האירוע" placeholder="חוות דעת" />
          <NumField name="intervalMonths" label="כל כמה חודשים" defaultValue={6} />
          <div className="flex flex-col">
            <label className="mb-1 text-sm text-muted">תנאי עצירה</label>
            <select name="stopMode" defaultValue="END_OF_SERVICE" className="rounded-md border border-border px-2 py-1.5 text-sm">
              <option value="END_OF_SERVICE">עד סוף השירות</option>
              <option value="UNTIL_OFFSET">עד חודש מסוים</option>
            </select>
          </div>
          <NumField name="stopOffsetMonths" label="עד חודש (אם נבחר)" defaultValue={24} />
          <AddButton>הוסף כרוני</AddButton>
        </form>
      )}
    </section>
  );
}

/* --- small form field helpers --- */
function TextField({ name, label, placeholder }: { name: string; label: string; placeholder?: string }) {
  return (
    <div className="flex flex-col">
      <label htmlFor={name} className="mb-1 text-sm text-muted">
        {label}
      </label>
      <input id={name} name={name} placeholder={placeholder} className="rounded-md border border-border px-3 py-1.5 text-sm" />
    </div>
  );
}
function NumField({ name, label, defaultValue, step }: { name: string; label: string; defaultValue: number; step?: string }) {
  return (
    <div className="flex flex-col">
      <label htmlFor={name} className="mb-1 text-sm text-muted">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="number"
        step={step ?? "1"}
        defaultValue={defaultValue}
        className="w-32 rounded-md border border-border px-3 py-1.5 text-sm"
      />
    </div>
  );
}
function AddButton({ children }: { children: React.ReactNode }) {
  return (
    <button className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700">{children}</button>
  );
}
