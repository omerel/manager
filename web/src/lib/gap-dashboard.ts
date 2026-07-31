import type { AccessLevel, OrgKind } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { Visibility } from "@/lib/access";
import { computePersonGaps, type GapLevel } from "@/lib/gaps";

const personGapInclude = {
  pointProgress: true,
  metricReadings: true,
  evalEntries: { select: { recurringEventId: true, occurrenceOffset: true } },
  assignedPlan: {
    include: {
      pointEvents: true,
      cumulativeMetrics: { include: { checkpoints: true } },
      recurringEvents: true,
      // without this the rollup would count items the person was never asked for
      assignment: { select: { waiverOffsetMonths: true, waivers: true } },
    },
  },
} as const;

export type GapPerson = { id: string; name: string; status: GapLevel | null };

export type GapTreeNode = {
  id: string;
  name: string;
  kind: OrgKind;
  level: AccessLevel | null;
  total: number; // people
  red: number; // people in overdue
  yellow: number; // people approaching (worst status)
  overdueEvents: number; // count of overdue gap items
  approachingEvents: number; // count of approaching gap items
  people: GapPerson[]; // only populated on TEAM nodes
  children: GapTreeNode[];
};

/** Build the scoped org forest with per-node counts of people and gap events. */
export async function buildGapTree(visibility: Visibility, today: Date): Promise<GapTreeNode[]> {
  const [nodes, people] = await Promise.all([
    prisma.orgNode.findMany(),
    prisma.person.findMany({ where: { teamId: { in: [...visibility.nodeIds] } }, include: personGapInclude }),
  ]);

  const visible = nodes.filter((n) => visibility.nodeIds.has(n.id));
  const visibleIds = new Set(visible.map((n) => n.id));

  const peopleByTeam = new Map<string, GapPerson[]>();
  const overdueEventsByTeam = new Map<string, number>();
  const approachingEventsByTeam = new Map<string, number>();

  for (const p of people) {
    if (!p.teamId) continue; // unassigned people belong to no framework
    const { status, items } = computePersonGaps(p, today);
    const arr = peopleByTeam.get(p.teamId) ?? [];
    arr.push({ id: p.id, name: p.fullName, status });
    peopleByTeam.set(p.teamId, arr);

    const overdue = items.filter((i) => i.level === "OVERDUE").length;
    const approaching = items.filter((i) => i.level === "APPROACHING").length;
    overdueEventsByTeam.set(p.teamId, (overdueEventsByTeam.get(p.teamId) ?? 0) + overdue);
    approachingEventsByTeam.set(p.teamId, (approachingEventsByTeam.get(p.teamId) ?? 0) + approaching);
  }

  const childrenOf = new Map<string, typeof visible>();
  for (const n of visible) {
    if (n.parentId && visibleIds.has(n.parentId)) {
      const arr = childrenOf.get(n.parentId) ?? [];
      arr.push(n);
      childrenOf.set(n.parentId, arr);
    }
  }

  const build = (id: string): GapTreeNode => {
    const node = visible.find((n) => n.id === id)!;
    const children = (childrenOf.get(id) ?? [])
      .sort((a, b) => a.name.localeCompare(b.name, "he"))
      .map((c) => build(c.id));
    const own = peopleByTeam.get(id) ?? [];
    const total = own.length + children.reduce((s, c) => s + c.total, 0);
    const red = own.filter((p) => p.status === "OVERDUE").length + children.reduce((s, c) => s + c.red, 0);
    const yellow = own.filter((p) => p.status === "APPROACHING").length + children.reduce((s, c) => s + c.yellow, 0);
    const overdueEvents = (overdueEventsByTeam.get(id) ?? 0) + children.reduce((s, c) => s + c.overdueEvents, 0);
    const approachingEvents = (approachingEventsByTeam.get(id) ?? 0) + children.reduce((s, c) => s + c.approachingEvents, 0);
    return {
      id: node.id,
      name: node.name,
      kind: node.kind,
      level: visibility.levelOf(node.id),
      total,
      red,
      yellow,
      overdueEvents,
      approachingEvents,
      people: own.sort((a, b) => a.name.localeCompare(b.name, "he")),
      children,
    };
  };

  const roots = visible.filter((n) => !n.parentId || !visibleIds.has(n.parentId));
  return roots.sort((a, b) => a.name.localeCompare(b.name, "he")).map((r) => build(r.id));
}
