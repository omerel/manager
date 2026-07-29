import type { EmploymentStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { KIND_LABEL } from "@/lib/org";
import type { Visibility } from "@/lib/access";

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
  canEdit: boolean;
};

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
  const [people, resolvePath] = await Promise.all([
    prisma.person.findMany({ where, orderBy: { fullName: "asc" } }),
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
    canEdit: canEditTeam(visibility, p.teamId),
  }));
}

/** A single person, only if the user may see them; otherwise null. */
export async function getVisiblePerson(id: string, visibility: Visibility): Promise<PersonRow | null> {
  const p = await prisma.person.findUnique({ where: { id } });
  if (!p) return null;
  const isVisible = p.teamId ? visibility.nodeIds.has(p.teamId) : visibility.isAdmin;
  if (!isVisible) return null;
  const resolvePath = await buildPathResolver();
  return {
    id: p.id,
    fullName: p.fullName,
    recruitmentDate: p.recruitmentDate,
    status: p.status,
    endOfServiceDate: p.endOfServiceDate,
    teamId: p.teamId,
    photoPath: p.photoPath,
    orgPath: resolvePath(p.teamId),
    canEdit: canEditTeam(visibility, p.teamId),
  };
}

const dateFmt = new Intl.DateTimeFormat("he-IL", { year: "numeric", month: "long", day: "numeric" });
export function formatDate(d: Date | null): string {
  return d ? dateFmt.format(d) : "—";
}

export { KIND_LABEL };
