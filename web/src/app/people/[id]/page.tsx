import Link from "next/link";
import { notFound } from "next/navigation";
import { computeVisibility } from "@/lib/access";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getFieldDefs, formatFieldValue } from "@/lib/person-schema";
import { STATUS_LABEL, getEditableTeams, UNASSIGNED_LABEL } from "@/lib/people";
import { ageFromBirthDate } from "@/lib/person-name";
import { fmtDate, toDateInput } from "@/lib/dates";
import { getPersonFull, buildPersonTimeline, type PersonFull } from "@/lib/person-view";
import { computePersonGaps, levelForPoint, evalMetric, GAP_META, type GapLevel } from "@/lib/gaps";
import { PersonFormFields } from "@/components/PersonFormFields";
import { MetricCurve } from "@/components/MetricCurve";
import { CircleDot, TrendingUp, Map as MapIcon } from "lucide-react";
import { EvaluationsSection } from "@/components/EvaluationsSection";
import { ExtractionPanel, type ExtractionJobView } from "@/components/ExtractionPanel";
import { FileDrop } from "@/components/FileDrop";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { setProfilePhoto, type ProposalItem } from "@/lib/extract-actions";
import { effectiveStatus, staleError, STALE_MS } from "@/lib/jobs";
import {
  updatePerson,
  assignPlan,
  unassignPlan,
  setPointDone,
  clearPointDone,
  setMetricReading,
  reassignTeam,
} from "@/lib/person-actions";

export default async function PersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string; busy?: string }>;
}) {
  const { id } = await params;
  const { edit, busy } = await searchParams;
  const user = await getSessionUser();
  const visibility = await computeVisibility(user);

  const person = await getPersonFull(id);
  const isVisible = person && (person.teamId ? visibility.nodeIds.has(person.teamId) : visibility.isAdmin);
  if (!person || !isVisible) notFound();

  const canEdit = person.teamId ? visibility.canEdit(person.teamId) : visibility.isAdmin;
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
                src={`/photo/${person.id}`}
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

      <PlanSection person={person} templates={templates} timeline={timeline} canEdit={editing} today={today} />

      <EvaluationsSection person={person} recurrences={timeline.recurrences} editing={editing} today={today} />
    </div>
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
          <form action={assignPlan} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="personId" value={person.id} />
            <select name="templateId" className="rounded-md border border-border px-3 py-1.5 text-sm">
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700">שייך תכנית (עותק)</button>
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
          <form action={unassignPlan}>
            <input type="hidden" name="personId" value={person.id} />
            <button className="text-xs text-red-600 hover:underline">בטל שיוך</button>
          </form>
        )}
      </div>

      {/* Point events */}
      <div>
        <h3 className="mb-2 flex items-center gap-1.5 font-medium"><CircleDot className="h-4 w-4 text-brand-600" aria-hidden /> אירועים נקודתיים</h3>
        <ul className="divide-y divide-border rounded-md border border-border">
          {timeline.points.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <GapBadge level={levelForPoint({ dueDate: p.dueDate, done: p.done, doneOn: p.doneOn }, today)} />
                <span className="font-medium">{p.label}</span>
                <span className="text-muted">· יעד: {fmtDate(p.dueDate)}</span>
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
            const ev = evalMetric(
              { name: m.name, unit: m.unit, checkpoints: m.checkpoints.map((c) => ({ offsetMonths: c.offsetMonths, target: c.target })), value: m.value },
              person.recruitmentDate,
              today,
            );
            return (
            <div key={m.id} className="rounded-md border border-border px-3 py-2 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <GapBadge level={ev.level} />
                {m.name} <span className="text-muted">({m.unit})</span>
                <span className="text-xs text-muted">· {ev.detail}</span>
              </div>
              <div className="mt-1 text-muted">
                יעדים: {m.checkpoints.map((c) => `${c.target} עד ${fmtDate(c.dueDate)}`).join(" · ") || "—"}
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
        המופעים הכרוניים (חוו״ד וכד׳) מנוהלים בסעיף ״חוות דעת ואירועים״ למטה — מילוי מופע מכבה את הפער שלו.
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
