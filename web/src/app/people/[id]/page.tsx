import Link from "next/link";
import { notFound } from "next/navigation";
import { computeVisibility } from "@/lib/access";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getFieldDefs, formatFieldValue } from "@/lib/person-schema";
import { getInterviewFormat } from "@/lib/branding";
import { STATUS_LABEL, getEditableTeams, UNASSIGNED_LABEL } from "@/lib/people";
import { ageFromBirthDate } from "@/lib/person-name";
import { fmtDate, addMonths } from "@/lib/dates";
import { DateField } from "@/components/DateField";
import { ActionForm } from "@/components/ActionForm";
import { getPersonFull, buildPersonTimeline, buildVectorView, type PersonFull } from "@/lib/person-view";
import { getPlan } from "@/lib/plans";
import { buildPlanDiagramSvg, STATUS_STYLE, VECTOR_LEGEND } from "@/lib/plan-diagram";
import { computePersonGaps, levelForPoint, evalMetric, isPointDone, GAP_META, type GapLevel } from "@/lib/gaps";
import { watchContextFor } from "@/lib/watch";
import { PersonFormFields } from "@/components/PersonFormFields";
import { MetricCurve } from "@/components/MetricCurve";
import { CircleDot, FileDown, History, Map as MapIcon, Paperclip, Route, Star, TrendingUp } from "lucide-react";
import { EvaluationsSection } from "@/components/EvaluationsSection";
import { GapBanner, PersonalDetails, PlanSection } from "@/components/person-card";
import { ExtractionPanel, type ExtractionJobView } from "@/components/ExtractionPanel";
import { FileDrop } from "@/components/FileDrop";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { VectorLightbox } from "@/components/VectorLightbox";
import { setProfilePhoto, type ProposalItem } from "@/lib/extract-actions";
import { effectiveStatus, staleError, STALE_MS } from "@/lib/jobs";
import { versionedUrl } from "@/lib/upload-version";
import {
  updatePerson,
  unassignPlan,
  setPointDone,
  addPersonalEvent,
  removePersonalEvent,
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
  const watches = await watchContextFor(person.id, today);
  const gaps = computePersonGaps(person, today, watches);

  // The career vector: built HERE, on every open, from the person's own plan
  // copy — nothing is stored and nothing needs syncing. Coloured by this
  // person's standing, which is why it must draw their copy and not the
  // template they came from.
  const planForVector = person.assignedPlanId ? await getPlan(person.assignedPlanId) : null;
  const vectorSvg = planForVector
    ? (() => {
        // status AND occurrences from the same timeline — see buildVectorView
        const v = buildVectorView(timeline, person.placementDate, today, watches);
        return buildPlanDiagramSvg(planForVector, v.status, v.occurrences);
      })()
    : null;
  // adding an obligation to someone's path is an establishment act, like enrolling them
  const canAddPersonal = person.teamId ? visibility.mayEstablishAt(person.teamId) : visibility.isAdmin;
  const interviewFormat = await getInterviewFormat();

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
    today.getTime() - extractRun.createdAt.getTime() < STALE_MS;

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
          <ActionForm action={setProfilePhoto} className="mt-2 flex flex-wrap items-center gap-2">
            <input type="hidden" name="personId" value={person.id} />
            <label className="text-sm text-muted">תמונת פרופיל:</label>
            <FileDrop name="photo" accept="image/*" required label="גרור/י תמונה" className="min-w-56" />
            <button className="rounded-md border border-border px-3 py-1 text-sm hover:bg-slate-50">
              {person.photoPath ? "החלף תמונה" : "העלה תמונה"}
            </button>
          </ActionForm>
        )}
        {editing && editableTeams.length > 0 && (
          <ActionForm action={reassignTeam} className="mt-2 flex flex-wrap items-center gap-2">
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
          </ActionForm>
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

      {/* Details on the primary (right) side, the career vector on the left.
          Details come FIRST in the DOM, so a narrow screen stacks them above
          the drawing rather than below it. */}
      <div className={vectorSvg ? "grid gap-6 lg:grid-cols-2" : undefined}>
        <PersonalDetails person={person} defs={defs} valueByDef={valueByDef} canEdit={editing} />
        {vectorSvg && (
          <section className="space-y-3 rounded-xl border border-border/70 bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Route className="h-5 w-5 text-brand-600" aria-hidden />
                תכנית קריירה
              </h2>
              <a
                href={`/people/${person.id}/plan-pdf`}
                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-stone-50"
              >
                <FileDown className="h-4 w-4 text-brand-600" aria-hidden />
                הפק PDF
              </a>
            </div>
            {/* the legend reads the same list the drawing and the PDF do */}
            <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
              המסלול של {person.firstName} כפי שהוא נמדד — מצבו מול כל אירוע:
              {VECTOR_LEGEND.map((l) => {
                const c = STATUS_STYLE[l.status];
                return (
                  <span
                    key={l.status}
                    className="rounded-full border px-2 text-xs font-medium"
                    style={{ backgroundColor: c.bg, borderColor: c.border, color: c.accent }}
                  >
                    {l.label}
                  </span>
                );
              })}
              <span className="rounded-full border border-amber-300 bg-amber-50 px-2 text-xs font-medium text-amber-700">
                ★ אירוע אישי
              </span>
            </p>
            <VectorLightbox svg={vectorSvg} />
          </section>
        )}
      </div>

      {preview ? (
        <AssignmentReview preview={preview} backHref={`/people/${person.id}?edit=1`} />
      ) : (
        <PlanSection person={person} templates={templates} timeline={timeline} canEdit={editing} canAddPersonal={canAddPersonal} today={today} watches={watches} />
      )}

      <PlanHistorySection person={person} />

      <EvaluationsSection person={person} recurrences={timeline.recurrences} editing={editing} today={today} interviewFormat={interviewFormat} watches={watches} />
    </div>
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
          // only the COMPLETED ones: a watch row carries no doneOn and is not progress
          const doneIds = new Set(person.pointProgress.filter(isPointDone).map((pp) => pp.pointEventId));
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
                    <li key={e.id}>⊘ {e.label} · יעד היה {fmtDate(addMonths(person.placementDate, e.offsetMonths))}</li>
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





