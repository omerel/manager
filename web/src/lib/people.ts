import type { EmploymentStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { KIND_LABEL } from "@/lib/org";
import type { Visibility } from "@/lib/access";
import type { DeletionImpact } from "@/lib/deletion-impact";

export const STATUS_LABEL: Record<EmploymentStatus, string> = {
  ACTIVE: "פעיל",
  PLANNED_END: "סיום מתוכנן",
  DEPARTED: "עזב",
};

export const UNASSIGNED_LABEL = "ללא שיוך";

export type PersonRow = {
  id: string;
  fullName: string;
  recruitmentDate: Date;
  status: EmploymentStatus;
  endOfServiceDate: Date | null;
  teamId: string | null;
  photoPath: string | null;
  orgPath: string; // "מרכז ▸ תחום ▸ מדור ▸ צוות" or "ללא שיוך"
  /** the active plan copy's name, or null when the person has no plan */
  planName: string | null;
  /** the template that copy came from — null if it has since been deleted */
  planTemplateId: string | null;
  canEdit: boolean;
  impact: DeletionImpact;
};

const IMPACT_COUNTS = {
  planAssignments: true,
  evalEntries: true,
  pointProgress: true,
  metricReadings: true,
} as const;

/** Distinct from the framework column's "ללא שיוך": adjacent columns must not read alike. */
export const NO_PLAN_LABEL = "ללא מסלול";

/** Build "center ▸ domain ▸ section ▸ team" for a team node (or the unassigned label). */
async function buildPathResolver() {
  const nodes = await prisma.orgNode.findMany();
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return (teamId: string | null): string => {
    if (!teamId) return UNASSIGNED_LABEL;
    const parts: string[] = [];
    let cur = byId.get(teamId);
    while (cur) {
      parts.unshift(cur.name);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return parts.length ? parts.join(" ▸ ") : UNASSIGNED_LABEL;
  };
}

/** Can this user edit this person's placement/data? Unassigned people are admin-only. */
function canEditTeam(visibility: Visibility, teamId: string | null): boolean {
  return teamId ? visibility.canEdit(teamId) : visibility.isAdmin;
}

/** Teams the user may EDIT (for placing a new person), with their org path. */
export async function getEditableTeams(visibility: Visibility): Promise<{ id: string; path: string }[]> {
  const [nodes, resolvePath] = await Promise.all([prisma.orgNode.findMany(), buildPathResolver()]);
  return nodes
    .filter((n) => n.kind === "TEAM" && visibility.canEdit(n.id))
    .map((n) => ({ id: n.id, path: resolvePath(n.id) }))
    .sort((a, b) => a.path.localeCompare(b.path, "he"));
}

/** People within the user's visibility. Admins also see unassigned people (teamId = null). */
export async function getVisiblePeople(visibility: Visibility): Promise<PersonRow[]> {
  const teamIds = [...visibility.nodeIds];
  const where = visibility.isAdmin
    ? { OR: [{ teamId: { in: teamIds } }, { teamId: null }] }
    : { teamId: { in: teamIds } };
  const [people, attachmentsByPerson, resolvePath] = await Promise.all([
    // the plan and the deletion counts come along in this query rather than per
    // row: _count compiles to one query with sub-counts, and measured on the
    // 40-person registry the whole list costs 7.6ms against 1.1ms without —
    // less than counting a single person on demand (9.0ms).
    prisma.person.findMany({
      where,
      orderBy: { fullName: "asc" },
      include: {
        assignedPlan: { select: { name: true, sourceTemplateId: true } },
        _count: { select: IMPACT_COUNTS },
      },
    }),
    countAttachmentsByPerson(where),
    buildPathResolver(),
  ]);
  return people.map((p) => ({
    id: p.id,
    fullName: p.fullName,
    recruitmentDate: p.recruitmentDate,
    status: p.status,
    endOfServiceDate: p.endOfServiceDate,
    teamId: p.teamId,
    photoPath: p.photoPath,
    orgPath: resolvePath(p.teamId),
    planName: p.assignedPlan?.name ?? null,
    planTemplateId: p.assignedPlan?.sourceTemplateId ?? null,
    canEdit: canEditTeam(visibility, p.teamId),
    impact: {
      planAssignments: p._count.planAssignments,
      evalEntries: p._count.evalEntries,
      attachments: attachmentsByPerson.get(p.id) ?? 0,
      pointProgress: p._count.pointProgress,
      metricReadings: p._count.metricReadings,
      hasPhoto: p.photoPath !== null,
    },
  }));
}

/**
 * Attachments per person. Separate because Attachment hangs off EvalEntry, not
 * off Person, so _count cannot reach it — one query over the entries either
 * way, and 1.6ms for the whole list.
 */
async function countAttachmentsByPerson(where: object): Promise<Map<string, number>> {
  const entries = await prisma.evalEntry.findMany({
    where: { person: where },
    select: { personId: true, _count: { select: { attachments: true } } },
  });
  const byPerson = new Map<string, number>();
  for (const e of entries) {
    byPerson.set(e.personId, (byPerson.get(e.personId) ?? 0) + e._count.attachments);
  }
  return byPerson;
}

/** A single person, only if the user may see them; otherwise null. */
export async function getVisiblePerson(id: string, visibility: Visibility): Promise<PersonRow | null> {
  const p = await prisma.person.findUnique({
    where: { id },
    include: {
      assignedPlan: { select: { name: true, sourceTemplateId: true } },
      _count: { select: IMPACT_COUNTS },
    },
  });
  if (!p) return null;
  const isVisible = p.teamId ? visibility.nodeIds.has(p.teamId) : visibility.isAdmin;
  if (!isVisible) return null;
  const [resolvePath, attachments] = await Promise.all([
    buildPathResolver(),
    prisma.attachment.count({ where: { entry: { personId: id } } }),
  ]);
  return {
    id: p.id,
    fullName: p.fullName,
    recruitmentDate: p.recruitmentDate,
    status: p.status,
    endOfServiceDate: p.endOfServiceDate,
    teamId: p.teamId,
    photoPath: p.photoPath,
    orgPath: resolvePath(p.teamId),
    planName: p.assignedPlan?.name ?? null,
    planTemplateId: p.assignedPlan?.sourceTemplateId ?? null,
    canEdit: canEditTeam(visibility, p.teamId),
    impact: {
      planAssignments: p._count.planAssignments,
      evalEntries: p._count.evalEntries,
      attachments,
      pointProgress: p._count.pointProgress,
      metricReadings: p._count.metricReadings,
      hasPhoto: p.photoPath !== null,
    },
  };
}

const dateFmt = new Intl.DateTimeFormat("he-IL", { year: "numeric", month: "long", day: "numeric" });
export function formatDate(d: Date | null): string {
  return d ? dateFmt.format(d) : "—";
}

export { KIND_LABEL };
export { destroysNothingElse, type DeletionImpact } from "@/lib/deletion-impact";
