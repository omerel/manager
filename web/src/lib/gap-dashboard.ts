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

/**
 * The gap kinds the dashboard can be narrowed to.
 *
 * "all" means DO NOT FILTER — and that is expressed differently by each list,
 * because the lists are different things. The tree lists a team's people, so
 * "all" keeps everyone including those meeting their plan. The needs-attention
 * panel lists problems, so "all" means both kinds of problem and never included
 * anyone green in the first place.
 *
 * One rule, two expressions. Defining "all" uniformly as "overdue and
 * approaching" would silently drop compliant people out of the tree in the
 * DEFAULT state, which is a loss nobody asked for.
 */
export type GapKind = "all" | "overdue" | "approaching";

export function parseGapKind(raw: string | undefined): GapKind {
  return raw === "overdue" || raw === "approaching" ? raw : "all";
}

export const GAP_KIND_LABEL: Record<GapKind, string> = {
  all: "הכל",
  overdue: "אי-עמידה",
  approaching: "מתקרב",
};

/** Does this person belong in a list of PROBLEMS under this kind? Green people never do. */
export function isAttention(status: GapLevel | null, kind: GapKind): boolean {
  if (status !== "OVERDUE" && status !== "APPROACHING") return false;
  if (kind === "all") return true;
  return kind === "overdue" ? status === "OVERDUE" : status === "APPROACHING";
}

/** Does this person belong in the TREE's list of a team's people under this kind? */
export function belongsInTree(status: GapLevel | null, kind: GapKind): boolean {
  if (kind === "all") return true; // the tree is a roster, not a problem list
  return isAttention(status, kind);
}

/** Depth-first search for a node in an already-built forest. */
export function findNode(roots: GapTreeNode[], id: string): GapTreeNode | null {
  for (const r of roots) {
    if (r.id === id) return r;
    const hit = findNode(r.children, id);
    if (hit) return hit;
  }
  return null;
}

/** Every node in the forest, flattened, with its full path — for the chooser. */
export function flattenWithPaths(roots: GapTreeNode[]): { id: string; path: string; kind: OrgKind }[] {
  const out: { id: string; path: string; kind: OrgKind }[] = [];
  const walk = (n: GapTreeNode, prefix: string[]) => {
    const path = [...prefix, n.name];
    out.push({ id: n.id, path: path.join(" ▸ "), kind: n.kind });
    for (const c of n.children) walk(c, path);
  };
  for (const r of roots) walk(r, []);
  return out.sort((a, b) => a.path.localeCompare(b.path, "he"));
}

/** The people in a subtree that belong in a problem list, with the path to each. */
export function attentionList(root: GapTreeNode, kind: GapKind): { id: string; name: string; path: string; status: GapLevel }[] {
  const out: { id: string; name: string; path: string; status: GapLevel }[] = [];
  const walk = (n: GapTreeNode, prefix: string[]) => {
    for (const p of n.people) {
      if (isAttention(p.status, kind)) {
        out.push({ id: p.id, name: p.name, path: [...prefix, n.name].join(" ▸ "), status: p.status as GapLevel });
      }
    }
    for (const c of n.children) walk(c, [...prefix, n.name]);
  };
  walk(root, []);
  // overdue first: a failure that has already happened outranks one that has not
  return out.sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name, "he") : a.status === "OVERDUE" ? -1 : 1));
}

/** The same tree with each team's people list narrowed to the chosen kind. */
export function narrowTree(roots: GapTreeNode[], kind: GapKind): GapTreeNode[] {
  if (kind === "all") return roots; // untouched, so the default cannot drift
  const narrow = (n: GapTreeNode): GapTreeNode => ({
    ...n,
    people: n.people.filter((p) => belongsInTree(p.status, kind)),
    children: n.children.map(narrow),
  });
  return roots.map(narrow);
}
