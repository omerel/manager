import Link from "next/link";
import { notFound } from "next/navigation";
import { computeVisibility } from "@/lib/access";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getFieldDefs, formatFieldValue } from "@/lib/person-schema";
import { STATUS_LABEL, getEditableTeams, UNASSIGNED_LABEL } from "@/lib/people";
import { ageFromBirthDate } from "@/lib/person-name";
import { fmtDate, toDateInput, addMonths } from "@/lib/dates";
import { getPersonFull, buildPersonTimeline, type PersonFull } from "@/lib/person-view";
import { computePersonGaps, levelForPoint, evalMetric, GAP_META, type GapLevel } from "@/lib/gaps";
import { PersonFormFields } from "@/components/PersonFormFields";
import { MetricCurve } from "@/components/MetricCurve";
import { CircleDot, History, Map as MapIcon, TrendingUp } from "lucide-react";
import { EvaluationsSection } from "@/components/EvaluationsSection";
import { ExtractionPanel, type ExtractionJobView } from "@/components/ExtractionPanel";
import { FileDrop } from "@/components/FileDrop";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { setProfilePhoto, type ProposalItem } from "@/lib/extract-actions";
import { effectiveStatus, staleError, STALE_MS } from "@/lib/jobs";
import { versionedUrl } from "@/lib/upload-version";
import {
  updatePerson,
  assignPlan,
  unassignPlan,
  setPointDone,
  clearPointDone,
  setMetricReading,
  reassignTeam,
} from "@/lib/person-actions";
import { buildAssignmentPreview } from "@/lib/plan-assignment";
import { AssignmentReview } from "@/components/AssignmentReview";

export default async function PersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string; busy?: string; assign?: string }>;
}) {
  const { id } = await params;
  const { edit, busy, assign } = await searchParams;
  const user = await getSessionUser();
  const visibility = await computeVisibility(user);

  const person = await getPersonFull(id);
  const isVisible = person && (person.teamId ? visibility.nodeIds.has(person.teamId) : visibility.isAdmin);
  if (!person || !isVisible) notFound();

  const canEdit = person.teamId ? visibility.canEdit(person.teamId) : visibility.isAdmin;
  // choosing a template opens the review step rather than assigning immediately
  const preview = assign && canEdit ? await buildAssignmentPreview(id, assign) : null;
  // The page is view-first; edit forms appear only in edit mode (?edit=1, permission-gated).
  const editing = canEdit && edit === "1";
  const [defs, templates, editableTeams] = await Promise.all([
    getFieldDefs(),
    prisma.careerPlan.findMany({ where: { isTemplate: true }, orderBy: { name: "asc" } }),
    getEditableTeams(visibility),
  ]);

  // org path
  const nodes = await prisma.orgNode.findMany();
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const path: string[] = [];
  let cur = person.teamId ? byId.get(person.teamId) : undefined;
  while (cur) {
    path.unshift(cur.name);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  const orgPath = path.length ? path.join(" ▸ ") : UNASSIGNED_LABEL;

  const valueByDef: Record<string, string> = {};
  for (const fv of person.fieldValues) valueByDef[fv.fieldDefId] = fv.value;

  const timeline = buildPersonTimeline(person);
  const today = new Date();
  const gaps = computePersonGaps(person, today);

  const proposalRow = editing
    ? await prisma.extractionProposal.findFirst({ where: { personId: person.id }, orderBy: { createdAt: "desc" } })
    : null;
  const proposal = proposalRow ? { id: proposalRow.id, items: (proposalRow.items as ProposalItem[]) ?? [] } : null;

  // latest extraction job for this person (background run) — drives the panel's progress state
  const extractRun = editing
    ? await prisma.agentRun.findFirst({ where: { personId: person.id, kind: "EXTRACT" }, orderBy: { createdAt: "desc" } })
    : null;
  const extractJob: ExtractionJobView = extractRun
    ? { status: effectiveStatus(extractRun), error: staleError(extractRun) }
    : null;
  const emptyResult =
    !!extractRun &&
    extractJob?.status === "SUCCEEDED" &&
    extractRun.output === "0" &&
    !proposal &&
    Date.now() - extractRun.createdAt.getTime() < STALE_MS;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/people" className="text-sm text-muted hover:underline">
          ← חזרה לאנשים
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {person.photoPath ? (
              <PhotoLightbox
                src={versionedUrl(`/photo/${person.id}`, person.photoPath)}
                alt={person.fullName}
                className="h-14 w-14 rounded-full border border-border object-cover"
              />
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-slate-100 text-xl font-bold text-slate-500">
                {person.fullName.slice(0, 1)}
              </span>
            )}
            <h1 className="text-2xl font-bold">{person.fullName}</h1>
            {editing && (
              <span className="rounded bg-brand-100 px-2 py-0.5 text-xs text-brand-700">מצב עריכה</span>
            )}
            {!canEdit && (
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">צפייה בלבד</span>
            )}
          </div>
          {canEdit &&
            (editing ? (
              <Link
                href={`/people/${person.id}`}
                className="rounded-md border border-border px-4 py-1.5 text-sm hover:bg-slate-50"
              >
                סיום עריכה
              </Link>
            ) : (
              <Link
                href={`/people/${person.id}?edit=1`}
                className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                ✎ עריכה
              </Link>
            ))}
        </div>
        <p className="mt-1 text-muted">{orgPath}</p>
        {editing && (
          <form action={setProfilePhoto} className="mt-2 flex flex-wrap items-center gap-2">
            <input type="hidden" name="personId" value={person.id} />
            <label className="text-sm text-muted">תמונת פרופיל:</label>
            <FileDrop name="photo" accept="image/*" required label="גרור/י תמונה" className="min-w-56" />
            <button className="rounded-md border border-border px-3 py-1 text-sm hover:bg-slate-50">
              {person.photoPath ? "החלף תמונה" : "העלה תמונה"}
            </button>
          </form>
        )}
        {editing && editableTeams.length > 0 && (
          <form action={reassignTeam} className="mt-2 flex flex-wrap items-center gap-2">
            <input type="hidden" name="personId" value={person.id} />
            <label className="text-sm text-muted">שיוך למסגרת:</label>
            <select name="teamId" defaultValue={person.teamId ?? ""} className="rounded-md border border-border px-2 py-1 text-sm">
              {!person.teamId && <option value="">— {UNASSIGNED_LABEL}</option>}
              {editableTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.path}
                </option>
              ))}
            </select>
            <button className="rounded-md border border-border px-3 py-1 text-sm hover:bg-slate-50">שייך</button>
          </form>
        )}
      </div>

      {!person.teamId && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          עובד/ת זה/זו אינו/ה משויך/ת למסגרת. שייכ/י למסגרת כדי שיופיע/תופיע בדשבורד ובהיררכיה.
        </div>
      )}

      <GapBanner status={gaps.status} items={gaps.items} />

      {editing && (
        <ExtractionPanel
          personId={person.id}
          proposal={proposal}
          emptyResult={emptyResult}
          job={extractJob}
          busy={busy === "1"}
        />
      )}

      <PersonalDetails person={person} defs={defs} valueByDef={valueByDef} canEdit={editing} />

      {preview ? (
        <AssignmentReview preview={preview} backHref={`/people/${person.id}?edit=1`} />
      ) : (
        <PlanSection person={person} templates={templates} timeline={timeline} canEdit={editing} today={today} />
      )}

      <PlanHistorySection person={person} />

      <EvaluationsSection person={person} recurrences={timeline.recurrences} editing={editing} today={today} />
    </div>
  );
}

/** Never required of this person: the plan item predates their assignment. */
function WaivedBadge() {
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
function CarriedBadge({ from }: { from: string }) {
  return (
    <span className="rounded bg-brand-50 px-1.5 py-0.5 text-xs text-brand-800" title={`הועבר מ${from}`}>
      ↩ הועבר מ{from}
    </span>
  );
}

/* ---------- Plan history: assignments the person has left ---------- */
function PlanHistorySection({ person }: { person: PersonFull }) {
  const past = person.planAssignments;
  if (past.length === 0) return null;

  return (
    <section className="space-y-3 rounded-xl border border-border/70 bg-card p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <History className="h-5 w-5 text-brand-600" aria-hidden />
        מסלולים קודמים
      </h2>
      <p className="text-sm text-muted">
        מה שנרשם במסלולים האלה נשמר. אירוע שנדרש ולא בוצע מתועד כאן כ״לא בוצע״ — ואינו נספר כפער.
      </p>
      <ul className="space-y-3">
        {past.map((a) => {
          const doneIds = new Set(person.pointProgress.map((pp) => pp.pointEventId));
          const events = a.plan.pointEvents;
          const done = events.filter((e) => doneIds.has(e.id));
          const missed = events.filter((e) => !doneIds.has(e.id));
          const filed = person.evalEntries.filter(
            (e) => e.recurringEventId && a.plan.recurringEvents.some((r) => r.id === e.recurringEventId),
          ).length;
          return (
            <li key={a.id} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{a.templateName}</span>
                <span className="text-xs text-muted">
                  {fmtDate(a.assignedAt)} — {a.endedAt ? fmtDate(a.endedAt) : "כעת"}
                </span>
              </div>
              {a.reason && <p className="mt-1 text-sm text-muted">סיבת המעבר: {a.reason}</p>}
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-800">✅ בוצעו {done.length}</span>
                {missed.length > 0 && (
                  <span className="rounded bg-stone-100 px-2 py-0.5 text-stone-700">
                    ⊘ לא בוצעו {missed.length} — מתועד, לא נספר כפער
                  </span>
                )}
                {filed > 0 && <span className="rounded bg-brand-50 px-2 py-0.5 text-brand-800">📝 חוות דעת {filed}</span>}
              </div>
              {missed.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-muted">
                  {missed.map((e) => (
                    <li key={e.id}>⊘ {e.label} · יעד היה {fmtDate(addMonths(person.recruitmentDate, e.offsetMonths))}</li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ---------- Personal details (editable for editors) ---------- */
function PersonalDetails({
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
        <form action={updatePerson} className="space-y-4">
          <input type="hidden" name="personId" value={person.id} />
          <PersonFormFields
            defs={defs}
            valueByDef={valueByDef}
            core={{
              firstName: person.firstName,
              lastName: person.lastName,
              birthDate: person.birthDate,
              recruitmentDate: person.recruitmentDate,
              status: person.status,
              endOfServiceDate: person.endOfServiceDate,
            }}
          />
          <button className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700">שמור פרטים</button>
        </form>
      ) : (
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          <Field label="שם פרטי" value={person.firstName} />
          <Field label="שם משפחה" value={person.lastName} />
          <Field label="תאריך לידה" value={fmtDate(person.birthDate)} />
          <Field label="גיל" value={ageFromBirthDate(person.birthDate)} />
          <Field label="תאריך גיוס" value={fmtDate(person.recruitmentDate)} />
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
function PlanSection({
  person,
  templates,
  timeline,
  canEdit,
  today,
}: {
  person: PersonFull;
  templates: { id: string; name: string }[];
  timeline: ReturnType<typeof buildPersonTimeline>;
  canEdit: boolean;
  today: Date;
}) {
  const todayInput = toDateInput(today);

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
            <form action={unassignPlan}>
              <input type="hidden" name="personId" value={person.id} />
              <button className="text-xs text-red-600 hover:underline">בטל שיוך</button>
            </form>
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
              </span>
              {p.done ? (
                <div className="flex flex-col items-end gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-700">✅ הושלם {fmtDate(p.doneOn)}</span>
                    {canEdit && (
                      <form action={clearPointDone}>
                        <input type="hidden" name="personId" value={person.id} />
                        <input type="hidden" name="pointEventId" value={p.id} />
                        <button className="text-xs text-red-600 hover:underline">בטל</button>
                      </form>
                    )}
                  </div>
                  {p.note && <span className="text-xs text-muted">📝 {p.note}</span>}
                </div>
              ) : canEdit ? (
                <form action={setPointDone} className="flex flex-wrap items-center gap-1">
                  <input type="hidden" name="personId" value={person.id} />
                  <input type="hidden" name="pointEventId" value={p.id} />
                  <input type="date" name="doneOn" defaultValue={todayInput} className="rounded border border-border px-2 py-1 text-xs" />
                  <input
                    name="note"
                    placeholder="הערה (למשל: איזה מופע)"
                    className="w-44 rounded border border-border px-2 py-1 text-xs"
                  />
                  <button className="rounded bg-brand-600 px-2 py-1 text-xs text-white hover:bg-brand-700">סמן כהושלם</button>
                </form>
              ) : (
                <span className="text-muted">⬜ טרם</span>
              )}
            </li>
          ))}
          {timeline.points.length === 0 && <li className="px-3 py-2 text-sm text-muted">—</li>}
        </ul>
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
              person.recruitmentDate,
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
                recruitmentDate={person.recruitmentDate}
                asOf={m.asOf}
                today={today}
                unit={m.unit}
              />
              {canEdit && (
                <form action={setMetricReading} className="mt-2 flex flex-wrap items-center gap-1">
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
                  <input type="date" name="asOf" defaultValue={todayInput} className="rounded border border-border px-2 py-1 text-xs" />
                  <input
                    name="note"
                    defaultValue={m.note ?? ""}
                    placeholder="הערה (למשל: איזה קורס זיכה)"
                    className="w-52 rounded border border-border px-2 py-1 text-xs"
                  />
                  <button className="rounded bg-brand-600 px-2 py-1 text-xs text-white hover:bg-brand-700">עדכן ערך</button>
                </form>
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

function GapBadge({ level }: { level: GapLevel }) {
  const meta = GAP_META[level];
  return <span className={`rounded px-1.5 py-0.5 text-xs ${meta.badge}`}>{meta.icon} {meta.label}</span>;
}

function GapBanner({ status, items }: { status: GapLevel | null; items: { level: GapLevel }[] }) {
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
