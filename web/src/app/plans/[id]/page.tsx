import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlan, formatOffset, unrollRecurring, DEFAULT_STOP_MONTHS, type PlanWithEvents } from "@/lib/plans";
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
  updatePointEvent,
  updateCumulativeMetric,
  updateCheckpoint,
  updateRecurringEvent,
} from "@/lib/plan-actions";
import { InlineEdit } from "@/components/InlineEdit";
import { softColorFor } from "@/lib/palette";

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
          {plan.pointEvents.map((e) => {
            const summary = (
              <span>
                <span className="font-medium">{e.label}</span>{" "}
                <span className="text-sm text-muted">· {formatOffset(e.offsetMonths)}</span>
              </span>
            );
            return (
              <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2">
                {admin ? (
                  <InlineEdit view={summary} action={updatePointEvent} title="ערוך אירוע">
                    <input type="hidden" name="planId" value={plan.id} />
                    <input type="hidden" name="id" value={e.id} />
                    <TextField name={`label-${e.id}`} field="label" label="שם האירוע" defaultValue={e.label} required />
                    <NumField name={`offset-${e.id}`} field="offsetMonths" label="חודשים מהגיוס" defaultValue={e.offsetMonths} />
                  </InlineEdit>
                ) : (
                  summary
                )}
                {admin && <DeleteButton planId={plan.id} kind="point" id={e.id} />}
              </li>
            );
          })}
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
          {plan.cumulativeMetrics.map((m, mi) => {
            const c = softColorFor(m.color, mi);
            const nameSummary = (
              <span className="font-medium" style={{ color: c.accent }}>
                {m.name} <span className="text-sm opacity-70">({m.unit})</span>
              </span>
            );
            return (
            <div
              key={m.id}
              className="rounded-xl border p-4 shadow-sm"
              style={{ backgroundColor: c.bg, borderColor: c.border }}
            >
              <div className="flex items-center justify-between">
                {admin ? (
                  <InlineEdit view={nameSummary} action={updateCumulativeMetric} title="ערוך מדד">
                    <input type="hidden" name="planId" value={plan.id} />
                    <input type="hidden" name="id" value={m.id} />
                    <TextField name={`mname-${m.id}`} field="name" label="שם המדד" defaultValue={m.name} required />
                    <TextField name={`munit-${m.id}`} field="unit" label="יחידה" defaultValue={m.unit} />
                  </InlineEdit>
                ) : (
                  nameSummary
                )}
                {admin && <DeleteButton planId={plan.id} kind="metric" id={m.id} />}
              </div>
              {m.checkpoints.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {m.checkpoints.map((cp) => {
                    const cpSummary = (
                      <span>
                        {cp.target} {m.unit} עד {formatOffset(cp.offsetMonths)}
                      </span>
                    );
                    return (
                      <li
                        key={cp.id}
                        className="flex items-center gap-2 rounded-md border bg-card/70 px-2 py-1 text-sm"
                        style={{ borderColor: c.border }}
                      >
                        {admin ? (
                          <InlineEdit view={cpSummary} action={updateCheckpoint} title="ערוך יעד-ביניים">
                            <input type="hidden" name="planId" value={plan.id} />
                            <input type="hidden" name="id" value={cp.id} />
                            <NumField name={`cptarget-${cp.id}`} field="target" label={`יעד (${m.unit})`} defaultValue={cp.target} step="any" />
                            <NumField name={`cpoffset-${cp.id}`} field="offsetMonths" label="חודשים מהגיוס" defaultValue={cp.offsetMonths} />
                          </InlineEdit>
                        ) : (
                          cpSummary
                        )}
                        {admin && <DeleteButton planId={plan.id} kind="checkpoint" id={cp.id} />}
                      </li>
                    );
                  })}
                </ul>
              )}
              {admin && (
                <form action={addCheckpoint} className="mt-3 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="planId" value={plan.id} />
                  <input type="hidden" name="metricId" value={m.id} />
                  <NumField name={`newtarget-${m.id}`} field="target" label={`יעד (${m.unit})`} defaultValue={100} step="any" />
                  <NumField name={`newoffset-${m.id}`} field="offsetMonths" label="חודשים מהגיוס" defaultValue={6} />
                  <AddButton>הוסף יעד-ביניים</AddButton>
                </form>
              )}
            </div>
            );
          })}
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
      <h2 className="text-lg font-semibold">🔁 אירועים מחזוריים</h2>
      {plan.recurringEvents.length === 0 ? (
        <p className="text-sm text-muted">אין אירועים מחזוריים.</p>
      ) : (
        <ul className="space-y-2">
          {plan.recurringEvents.map((r, ri) => {
            const c = softColorFor(r.color, ri);
            const stop = r.stopOffsetMonths == null ? null : `עד ${formatOffset(r.stopOffsetMonths)}`;
            const preview = unrollRecurring(r.intervalMonths, r.stopOffsetMonths);
            const summary = (
              <span>
                <span className="font-medium" style={{ color: c.accent }}>
                  {r.label}
                </span>{" "}
                {stop ? (
                  <span className="text-sm text-muted">
                    · כל {r.intervalMonths} חודשים · {stop} · מופעים: {preview.map((o) => `+${o}`).join(", ") || "—"}
                  </span>
                ) : (
                  <span className="text-sm font-medium text-red-700">
                    · כל {r.intervalMonths} חודשים · חסר חודש עצירה — לא ייווצרו מופעים. יש לערוך ולהשלים.
                  </span>
                )}
              </span>
            );
            return (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-xl border px-4 py-2 shadow-sm"
                style={{ backgroundColor: c.bg, borderColor: c.border }}
              >
                {admin ? (
                  <InlineEdit view={summary} action={updateRecurringEvent} title="ערוך אירוע מחזורי">
                    <input type="hidden" name="planId" value={plan.id} />
                    <input type="hidden" name="id" value={r.id} />
                    <TextField name={`rlabel-${r.id}`} field="label" label="שם האירוע" defaultValue={r.label} required />
                    <NumField name={`rint-${r.id}`} field="intervalMonths" label="כל כמה חודשים" defaultValue={r.intervalMonths} />
                    <NumField
                      name={`rstopoff-${r.id}`}
                      field="stopOffsetMonths"
                      label="עד חודש מהגיוס"
                      defaultValue={r.stopOffsetMonths ?? DEFAULT_STOP_MONTHS}
                      required
                    />
                  </InlineEdit>
                ) : (
                  summary
                )}
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
          <NumField name="stopOffsetMonths" label="עד חודש מהגיוס" defaultValue={DEFAULT_STOP_MONTHS} required />
          <AddButton>הוסף מחזורי</AddButton>
        </form>
      )}
    </section>
  );
}

/* --- small form field helpers (`name` = element id, `field` = form field name) --- */
function TextField({
  name,
  field,
  label,
  placeholder,
  defaultValue,
  required,
}: {
  name: string;
  field?: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <label htmlFor={name} className="mb-1 text-sm text-muted">
        {label}
      </label>
      <input
        id={name}
        name={field ?? name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        className="rounded-md border border-border px-3 py-1.5 text-sm"
      />
    </div>
  );
}
function NumField({
  name,
  field,
  label,
  defaultValue,
  step,
  required,
}: {
  name: string;
  field?: string;
  label: string;
  defaultValue: number;
  step?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <label htmlFor={name} className="mb-1 text-sm text-muted">
        {label}
      </label>
      <input
        id={name}
        name={field ?? name}
        type="number"
        step={step ?? "1"}
        defaultValue={defaultValue}
        required={required}
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
