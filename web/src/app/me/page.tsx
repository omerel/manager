import { redirect } from "next/navigation";
import { FileDown, Route } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getGuestPersonOrNull } from "@/lib/guest-session";
import { getPersonFull, buildPersonTimeline, buildVectorStatus } from "@/lib/person-view";
import { getPlan } from "@/lib/plans";
import { buildPlanDiagramSvg, STATUS_STYLE, VECTOR_LEGEND } from "@/lib/plan-diagram";
import { computePersonGaps } from "@/lib/gaps";
import { getFieldDefs } from "@/lib/person-schema";
import { getInterviewFormat } from "@/lib/branding";
import { UNASSIGNED_LABEL } from "@/lib/people";
import { GapBanner, PersonalDetails, PlanSection } from "@/components/person-card";
import { EvaluationsSection } from "@/components/EvaluationsSection";
import { VectorLightbox } from "@/components/VectorLightbox";

/**
 * The guest's own record.
 *
 * Two properties carry the whole page, and both are structural rather than
 * checked:
 *
 * 1. NO identifier is taken from the URL. The person comes from the signed
 *    cookie alone, so there is no address a guest can type, edit or share that
 *    opens anyone else's record — nothing to compare, nothing to forget to
 *    compare.
 * 2. NO action is reachable. Every section is rendered read-only, and the page
 *    contains no form at all; a guest holds no user session, so any action they
 *    did reach would be refused by its own `getSessionUser()` anyway.
 *
 * It is a short composition of the same components the commander's card uses,
 * deliberately NOT a stripped-down copy of `people/[id]`. That page carries
 * edit mode, reassignment, extraction, the plan chooser and the movement
 * history — all of which need a `visibility` a guest does not have.
 */
export default async function MyRecordPage() {
  const guest = await getGuestPersonOrNull();
  if (!guest) redirect("/login");

  const person = await getPersonFull(guest.id);
  // getGuestPersonOrNull already refuses a person with no plan; this is the
  // same fact restated where the page would otherwise assume it
  if (!person?.assignedPlanId) redirect("/login");

  const [defs, interviewFormat, nodes] = await Promise.all([
    getFieldDefs(),
    getInterviewFormat(),
    prisma.orgNode.findMany(),
  ]);

  const byId = new Map(nodes.map((n) => [n.id, n] as const));
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
  const plan = await getPlan(person.assignedPlanId);
  const vectorSvg = plan
    ? buildPlanDiagramSvg(plan, buildVectorStatus(timeline, person.placementDate, today))
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-900">{person.fullName}</h1>
        <p className="mt-1 text-sm text-muted">{orgPath}</p>
      </div>

      <GapBanner status={gaps.status} items={gaps.items} />

      <div className={vectorSvg ? "grid gap-6 lg:grid-cols-2" : undefined}>
        <PersonalDetails person={person} defs={defs} valueByDef={valueByDef} canEdit={false} />
        {vectorSvg && (
          <section className="space-y-3 rounded-xl border border-border/70 bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Route className="h-5 w-5 text-brand-600" aria-hidden />
                תכנית קריירה
              </h2>
              <a
                href="/me/plan-pdf"
                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-stone-50"
              >
                <FileDown className="h-4 w-4 text-brand-600" aria-hidden />
                הפק PDF
              </a>
            </div>
            <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
              המסלול שלך כפי שהוא נמדד — מצבך מול כל אירוע:
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

      <PlanSection person={person} templates={[]} timeline={timeline} canEdit={false} canAddPersonal={false} today={today} />

      <EvaluationsSection person={person} recurrences={timeline.recurrences} editing={false} today={today} interviewFormat={interviewFormat} />
    </div>
  );
}
