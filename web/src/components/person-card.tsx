import Link from "next/link";
import { CircleDot, Map as MapIcon, Paperclip, Star, TrendingUp } from "lucide-react";
import { getFieldDefs, formatFieldValue } from "@/lib/person-schema";
import { STATUS_LABEL } from "@/lib/people";
import { ageFromBirthDate } from "@/lib/person-name";
import { fmtDate, addMonths } from "@/lib/dates";
import { ActionForm } from "@/components/ActionForm";
import { DateField } from "@/components/DateField";
import { PersonFormFields } from "@/components/PersonFormFields";
import { MetricCurve } from "@/components/MetricCurve";
import { PlanRowActions } from "@/components/PlanRowActions";
import { buildPersonTimeline, type PersonFull } from "@/lib/person-view";
import { levelForPoint, evalMetric, GAP_META, type GapLevel } from "@/lib/gaps";
import {
  updatePerson,
  unassignPlan,
  setPointDone,
  clearPointDone,
  setMetricReading,
  addPersonalEvent,
  removePersonalEvent,
} from "@/lib/person-actions";

/**
 * The read-and-write sections of a person's card.
 *
 * Lifted out of `people/[id]/page.tsx` when the guest self-view arrived: the
 * guest sees the same sections with `canEdit={false}`, and a second, read-only
 * copy of them would be a second truth — the next field added to the card would
 * appear on one page and not the other. Every one of these already took a
 * `canEdit` flag, so they were shared components in everything but location.
 *
 * Moved VERBATIM. The card page passes exactly what it passed before.
 */

/** Never required of this person: the plan item predates their assignment. */
export function WaivedBadge() {
  return (
    <span
      className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600"
      title="פטור — האירוע מוקדם ממועד שיוך העובד למסלול, ולכן מעולם לא נדרש ממנו"
    >
      פטור
    </span>
  );
}

/** Credited from a previous plan, not done under this one. */
export function CarriedBadge({ from }: { from: string }) {
  return (
    <span className="rounded bg-brand-50 px-1.5 py-0.5 text-xs text-brand-800" title={`הועבר מ${from}`}>
      ↩ הועבר מ{from}
    </span>
  );
}

/* ---------- Personal details (editable for editors) ---------- */
export function PersonalDetails({
  person,
  defs,
  valueByDef,
  canEdit,
}: {
  person: PersonFull;
  defs: Awaited<ReturnType<typeof getFieldDefs>>;
  valueByDef: Record<string, string>;
  canEdit: boolean;
}) {
  return (
    <section className="rounded-xl border border-border/70 bg-card shadow-sm p-5">
      <h2 className="mb-3 text-lg font-semibold">פרטים אישיים</h2>
      {canEdit ? (
        <ActionForm action={updatePerson} className="space-y-4">
          <input type="hidden" name="personId" value={person.id} />
          <PersonFormFields
            defs={defs}
            valueByDef={valueByDef}
            core={{
              firstName: person.firstName,
              lastName: person.lastName,
              birthDate: person.birthDate,
              recruitmentDate: person.recruitmentDate,
              placementDate: person.placementDate,
              status: person.status,
              endOfServiceDate: person.endOfServiceDate,
            }}
          />
          <button className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700">שמור פרטים</button>
        </ActionForm>
      ) : (
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          <Field label="שם פרטי" value={person.firstName} />
          <Field label="שם משפחה" value={person.lastName} />
          <Field label="תאריך לידה" value={fmtDate(person.birthDate)} />
          <Field label="גיל" value={ageFromBirthDate(person.birthDate)} />
          <Field label="תאריך גיוס" value={fmtDate(person.recruitmentDate)} />
          <Field label="תאריך הצבה ביחידה" value={fmtDate(person.placementDate)} />
          <Field label="סטטוס העסקה" value={STATUS_LABEL[person.status]} />
          <Field label="תאריך סיום שירות" value={fmtDate(person.endOfServiceDate)} />
          {person.fieldValues.map((fv) => (
            <Field key={fv.id} label={fv.field.label} value={formatFieldValue(fv.field.type, fv.value)} />
          ))}
        </dl>
      )}
    </section>
  );
}

/* ---------- Career plan + progress ---------- */
export function PlanSection({
  person,
  templates,
  timeline,
  canEdit,
  canAddPersonal,
  today,
}: {
  person: PersonFull;
  templates: { id: string; name: string }[];
  timeline: ReturnType<typeof buildPersonTimeline>;
  canEdit: boolean;
  /** establishment authority: may add or remove this person's own events */
  canAddPersonal: boolean;
  today: Date;
}) {

  if (!person.assignedPlan) {
    return (
      <section className="space-y-3 rounded-xl border border-border/70 bg-card shadow-sm p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-brand-900"><MapIcon className="h-5 w-5 text-brand-600" aria-hidden /> תכנית קריירה</h2>
        <p className="text-muted">לא שויכה תכנית.</p>
        {canEdit && templates.length > 0 && (
          <form method="get" className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="edit" value="1" />
            <select name="assign" className="rounded-md border border-border px-3 py-1.5 text-sm">
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
              בחר מסלול…
            </button>
          </form>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-border/70 bg-card shadow-sm p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">
          תכנית קריירה: <span className="font-normal">{person.assignedPlan.name}</span>{" "}
          <span className="text-xs text-muted">(עותק עצמאי)</span>
        </h2>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-3">
            <form method="get" className="flex items-center gap-1.5">
              <input type="hidden" name="edit" value="1" />
              <select name="assign" className="rounded-md border border-border px-2 py-1 text-xs">
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-stone-50">
                העבר למסלול אחר…
              </button>
            </form>
            <ActionForm action={unassignPlan}>
              <input type="hidden" name="personId" value={person.id} />
              <button className="text-xs text-red-600 hover:underline">בטל שיוך</button>
            </ActionForm>
          </div>
        )}
      </div>

      {/* Point events */}
      <div>
        <h3 className="mb-2 flex items-center gap-1.5 font-medium"><CircleDot className="h-4 w-4 text-brand-600" aria-hidden /> אירועים נקודתיים</h3>
        <ul className="divide-y divide-border rounded-md border border-border">
          {timeline.points.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="flex flex-wrap items-center gap-2">
                {p.waived ? <WaivedBadge /> : <GapBadge level={levelForPoint({ dueDate: p.dueDate, done: p.done, doneOn: p.doneOn }, today)} />}
                <span className={p.waived ? "text-muted" : "font-medium"}>{p.label}</span>
                <span className="text-muted">· יעד: {fmtDate(p.dueDate)}</span>
                {p.carriedFrom && <CarriedBadge from={p.carriedFrom} />}
                {p.personal && (
                  <span
                    className="flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900"
                    title={p.createdByName ? `אירוע אישי — הוסיף ${p.createdByName}` : "אירוע אישי"}
                  >
                    <Star className="h-3 w-3" aria-hidden />
                    אישי
                  </span>
                )}
                {p.guide && (
                  <a
                    href={p.guide.href}
                    className="flex items-center gap-1 rounded bg-brand-50 px-1.5 py-0.5 text-xs text-brand-800 hover:bg-brand-100"
                    title={`פורמטים והנחיות: ${p.guide.name}`}
                  >
                    <Paperclip className="h-3 w-3" aria-hidden />
                    פורמט
                  </a>
                )}
                {p.personal && canAddPersonal && canEdit && (
                  <ActionForm action={removePersonalEvent}>
                    <input type="hidden" name="personId" value={person.id} />
                    <input type="hidden" name="pointEventId" value={p.id} />
                    <button className="text-xs text-red-600 hover:underline">הסר</button>
                  </ActionForm>
                )}
              </span>
              {p.done ? (
                <div className="flex flex-col items-end gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-700">✅ הושלם {fmtDate(p.doneOn)}</span>
                    {canEdit && (
                      <ActionForm action={clearPointDone}>
                        <input type="hidden" name="personId" value={person.id} />
                        <input type="hidden" name="pointEventId" value={p.id} />
                        <button className="text-xs text-red-600 hover:underline">בטל</button>
                      </ActionForm>
                    )}
                  </div>
                  {p.note && <span className="text-xs text-muted">📝 {p.note}</span>}
                </div>
              ) : canEdit ? (
                <ActionForm action={setPointDone} className="flex flex-wrap items-center gap-1">
                  <input type="hidden" name="personId" value={person.id} />
                  <input type="hidden" name="pointEventId" value={p.id} />
                  <DateField name="doneOn" defaultDate={today} className="w-32 rounded border border-border px-2 py-1 text-xs text-end" />
                  <input
                    name="note"
                    placeholder="הערה (למשל: איזה מופע)"
                    className="w-44 rounded border border-border px-2 py-1 text-xs"
                  />
                  <button className="rounded bg-brand-600 px-2 py-1 text-xs text-white hover:bg-brand-700">סמן כהושלם</button>
                </ActionForm>
              ) : (
                <span className="text-muted">⬜ טרם</span>
              )}
            </li>
          ))}
          {timeline.points.length === 0 && <li className="px-3 py-2 text-sm text-muted">—</li>}
        </ul>

        {/* an obligation of this person's own — section level and above, and
            only while editing: adding one is a change, not a way to read */}
        {canAddPersonal && canEdit && (
          <ActionForm action={addPersonalEvent} className="mt-2 flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border p-3">
            <input type="hidden" name="personId" value={person.id} />
            <div className="flex flex-col">
              <label className="mb-1 text-xs text-muted">אירוע אישי</label>
              <input name="label" required placeholder="למשל: חפיפה עם הקודם" className="rounded-md border border-border px-2 py-1 text-sm" />
            </div>
            <div className="flex flex-col">
              <label className="mb-1 text-xs text-muted">מועד (שנים.חודשים מההצבה)</label>
              <input name="offset" required placeholder="1.6" dir="ltr" className="w-28 rounded-md border border-border px-2 py-1 text-sm text-end" />
            </div>
            <button className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
              <Star className="h-3.5 w-3.5" aria-hidden />
              הוסף אירוע אישי
            </button>
            <p className="w-full text-xs text-muted">
              אירוע שנדרש מ{person.firstName} בלבד. הוא נמדד ונספר כפער ככל אירוע, מסומן ★ על הוקטור, ועובר איתו במעבר מסלול.
            </p>
          </ActionForm>
        )}
      </div>

      {/* Cumulative metrics */}
      <div>
        <h3 className="mb-2 flex items-center gap-1.5 font-medium"><TrendingUp className="h-4 w-4 text-brand-600" aria-hidden /> מדדים מצטברים</h3>
        <div className="space-y-2">
          {timeline.metrics.map((m) => {
            // a waived checkpoint predates the assignment and must not bind
            const live = m.checkpoints.filter((c) => !c.waived);
            const ev = evalMetric(
              { name: m.name, unit: m.unit, checkpoints: live.map((c) => ({ offsetMonths: c.offsetMonths, target: c.target })), value: m.value },
              person.placementDate,
              today,
            );
            return (
            <div key={m.id} className="rounded-md border border-border px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center gap-2 font-medium">
                {live.length === 0 ? <WaivedBadge /> : <GapBadge level={ev.level} />}
                {m.name} <span className="text-muted">({m.unit})</span>
                {live.length > 0 && <span className="text-xs text-muted">· {ev.detail}</span>}
                {m.carriedFrom && <CarriedBadge from={m.carriedFrom} />}
              </div>
              <div className="mt-1 text-muted">
                יעדים:{" "}
                {m.checkpoints.length === 0
                  ? "—"
                  : m.checkpoints
                      .map((c) => `${c.target} עד ${fmtDate(c.dueDate)}${c.waived ? " (פטור)" : ""}`)
                      .join(" · ")}
              </div>
              <div className="mt-1">
                בפועל: {m.value !== null ? `${m.value} ${m.unit} (נכון ל-${fmtDate(m.asOf)})` : "— טרם נרשם"}
              </div>
              {m.note && <div className="mt-0.5 text-xs text-muted">📝 {m.note}</div>}
              <MetricCurve
                checkpoints={m.checkpoints.map((c) => ({ offsetMonths: c.offsetMonths, target: c.target }))}
                value={m.value}
                placementDate={person.placementDate}
                asOf={m.asOf}
                today={today}
                unit={m.unit}
              />
              {canEdit && (
                <ActionForm action={setMetricReading} className="mt-2 flex flex-wrap items-center gap-1">
                  <input type="hidden" name="personId" value={person.id} />
                  <input type="hidden" name="metricId" value={m.id} />
                  <input
                    type="number"
                    step="any"
                    name="value"
                    defaultValue={m.value ?? ""}
                    placeholder="ערך"
                    className="w-24 rounded border border-border px-2 py-1 text-xs"
                  />
                  <DateField name="asOf" defaultDate={today} className="w-32 rounded border border-border px-2 py-1 text-xs text-end" />
                  <input
                    name="note"
                    defaultValue={m.note ?? ""}
                    placeholder="הערה (למשל: איזה קורס זיכה)"
                    className="w-52 rounded border border-border px-2 py-1 text-xs"
                  />
                  <button className="rounded bg-brand-600 px-2 py-1 text-xs text-white hover:bg-brand-700">עדכן ערך</button>
                </ActionForm>
              )}
            </div>
            );
          })}
          {timeline.metrics.length === 0 && <p className="text-sm text-muted">—</p>}
        </div>
      </div>

      <p className="text-xs text-muted">
        המופעים המחזוריים (חוו״ד וכד׳) מנוהלים בסעיף ״חוות דעת ואירועים״ למטה — מילוי מופע מכבה את הפער שלו.
      </p>
    </section>
  );
}

export function GapBadge({ level }: { level: GapLevel }) {
  const meta = GAP_META[level];
  return <span className={`rounded px-1.5 py-0.5 text-xs ${meta.badge}`}>{meta.icon} {meta.label}</span>;
}

export function GapBanner({ status, items }: { status: GapLevel | null; items: { level: GapLevel }[] }) {
  if (status === null) {
    return (
      <div className="rounded-xl border border-border/70 bg-card shadow-sm px-4 py-3 text-sm text-muted">
        לא שויכה תכנית — אין מה למדוד עדיין.
      </div>
    );
  }
  const overdue = items.filter((i) => i.level === "OVERDUE").length;
  const approaching = items.filter((i) => i.level === "APPROACHING").length;
  const meta = GAP_META[status];
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-lg px-4 py-3 ${meta.badge}`}>
      <span className="text-lg">{meta.icon}</span>
      <span className="font-semibold">מצב פערים: {meta.label}</span>
      <span className="text-sm">
        🔴 {overdue} בפיגור · 🟡 {approaching} מתקרבים
      </span>
    </div>
  );
}

export function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
