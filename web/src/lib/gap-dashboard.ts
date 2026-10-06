import type { AccessLevel, OrgKind } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { Visibility } from "@/lib/access";
import { computePersonGaps, NO_WATCHES, type GapLevel } from "@/lib/gaps";
import { watchContextForMany } from "@/lib/watch";
import { UNASSIGNED_NODE_ID, UNASSIGNED_NODE_NAME, type GapKind } from "@/lib/gap-meta";
import { bySiblingOrder } from "@/lib/org-nesting";
export { UNASSIGNED_NODE_ID };
// The filter vocabulary lives in the CLIENT-SAFE module: the filter control is a
// client component, and importing a value from here would drag prisma into its
// bundle. Re-exported so existing importers are unaffected.
export { GAP_KIND_LABEL, GAP_KIND_ORDER, parseGapKind, type GapKind } from "@/lib/gap-meta";

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

/**
 * `status` is the person's worst level. `hasUnwatchedOverdue` cannot be derived
 * from it: a person in OVERDUE may have every overdue item acknowledged, or
 * none, and the filter «בפיגור ולא במעקב» is exactly that distinction. It is a
 * question about ITEMS, so it has to be answered where the items are.
 */
export type GapPerson = { id: string; name: string; status: GapLevel | null; hasUnwatchedOverdue: boolean };

export type GapTreeNode = {
  id: string;
  name: string;
  kind: OrgKind;
  level: AccessLevel | null;
  /** name of the user who commands this framework, if anyone does */
  commander: string | null;
  total: number; // people
  red: number; // people in overdue
  yellow: number; // people approaching (worst status)
  overdueEvents: number; // count of overdue gap items
  approachingEvents: number; // count of approaching gap items
  // A SUBSET of overdueEvents, not a deduction from it: these gaps are
  // acknowledged, not closed. If this number ever had to be subtracted anywhere,
  // a watch would have become an exemption.
  watchedEvents: number;
  /**
   * Age in days of the OLDEST watch under this node, or null if there is none.
   * A count alone makes a watch look like progress; «12 במעקב, הישן שבהם 27 ימים»
   * makes a watch that has quietly become a parking space visible from the top.
   */
  oldestWatchDays: number | null;
  people: GapPerson[]; // only populated on TEAM nodes
  children: GapTreeNode[];
};

/** Build the scoped org forest with per-node counts of people and gap events. */
export async function buildGapTree(visibility: Visibility, today: Date): Promise<GapTreeNode[]> {
  const [nodes, people, commanders] = await Promise.all([
    prisma.orgNode.findMany(),
    prisma.person.findMany({ where: { teamId: { in: [...visibility.nodeIds] } }, include: personGapInclude }),
    prisma.user.findMany({ where: { commandsNodeId: { not: null } }, select: { name: true, commandsNodeId: true } }),
  ]);
  const commanderOf = new Map(commanders.map((c) => [c.commandsNodeId!, c.name]));

  const visible = nodes.filter((n) => visibility.nodeIds.has(n.id));
  const visibleIds = new Set(visible.map((n) => n.id));

  const peopleByTeam = new Map<string, GapPerson[]>();
  const overdueEventsByTeam = new Map<string, number>();
  const approachingEventsByTeam = new Map<string, number>();
  // «מתוכם במעקב» — a SUBSET of the overdue count above, never a deduction from
  // it. One query for every visible person's marks; one per person would be one
  // query per person.
  const watchedEventsByTeam = new Map<string, number>();
  const oldestWatchByTeam = new Map<string, number>();
  const watchesByPerson = await watchContextForMany(people.map((p) => p.id), today);

  for (const p of people) {
    if (!p.teamId) continue; // unassigned people belong to no framework
    const { status, items } = computePersonGaps(p, today, watchesByPerson.get(p.id) ?? NO_WATCHES);
    const arr = peopleByTeam.get(p.teamId) ?? [];
    arr.push({
      id: p.id,
      name: p.fullName,
      status,
      hasUnwatchedOverdue: items.some((i) => i.level === "OVERDUE" && !i.watched),
    });
    peopleByTeam.set(p.teamId, arr);

    const overdue = items.filter((i) => i.level === "OVERDUE").length;
    const approaching = items.filter((i) => i.level === "APPROACHING").length;
    // counted among the overdue, and ALSO here — the two numbers overlap on purpose
    const watchedItems = items.filter((i) => i.level === "OVERDUE" && i.watched);
    const watched = watchedItems.length;
    const oldest = watchedItems.reduce((m, i) => Math.max(m, i.watchAgeDays ?? 0), -1);
    overdueEventsByTeam.set(p.teamId, (overdueEventsByTeam.get(p.teamId) ?? 0) + overdue);
    approachingEventsByTeam.set(p.teamId, (approachingEventsByTeam.get(p.teamId) ?? 0) + approaching);
    watchedEventsByTeam.set(p.teamId, (watchedEventsByTeam.get(p.teamId) ?? 0) + watched);
    if (oldest >= 0) oldestWatchByTeam.set(p.teamId, Math.max(oldestWatchByTeam.get(p.teamId) ?? 0, oldest));
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
    const children = (childrenOf.get(id) ?? []).sort(bySiblingOrder).map((c) => build(c.id));
    const own = peopleByTeam.get(id) ?? [];
    const total = own.length + children.reduce((s, c) => s + c.total, 0);
    const red = own.filter((p) => p.status === "OVERDUE").length + children.reduce((s, c) => s + c.red, 0);
    const yellow = own.filter((p) => p.status === "APPROACHING").length + children.reduce((s, c) => s + c.yellow, 0);
    const overdueEvents = (overdueEventsByTeam.get(id) ?? 0) + children.reduce((s, c) => s + c.overdueEvents, 0);
    const approachingEvents = (approachingEventsByTeam.get(id) ?? 0) + children.reduce((s, c) => s + c.approachingEvents, 0);
    const watchedEvents = (watchedEventsByTeam.get(id) ?? 0) + children.reduce((s, c) => s + c.watchedEvents, 0);
    const ages = [oldestWatchByTeam.get(id), ...children.map((c) => c.oldestWatchDays)].filter(
      (n): n is number => n != null,
    );
    const oldestWatchDays = ages.length ? Math.max(...ages) : null;
    return {
      id: node.id,
      name: node.name,
      kind: node.kind,
      level: visibility.levelOf(node.id),
      commander: commanderOf.get(node.id) ?? null,
      total,
      red,
      yellow,
      overdueEvents,
      approachingEvents,
      watchedEvents,
      oldestWatchDays,
      people: own.sort((a, b) => a.name.localeCompare(b.name, "he")),
      children,
    };
  };

  const roots = visible
    .filter((n) => !n.parentId || !visibleIds.has(n.parentId))
    .sort(bySiblingOrder)
    .map((r) => build(r.id));

  // The synthetic «לא משויכים» node: people outside every framework, shown
  // under the first visible root CENTER — a presentation choice, since they
  // belong to no center. A viewer without a center in sight does not get the
  // node at all: what is outside every framework is not under their
  // management. The node is fabricated here and exists on no other screen.
  const centerRoot = roots.find((r) => r.kind === "CENTER" && r.id !== UNASSIGNED_NODE_ID);
  if (centerRoot) {
    const unassigned = await prisma.person.findMany({ where: { teamId: null }, include: personGapInclude });
    const unassignedWatches = await watchContextForMany(unassigned.map((p) => p.id), today);
    const people: GapPerson[] = [];
    let overdueEvents = 0;
    let approachingEvents = 0;
    let watchedEvents = 0;
    let oldestWatchDays: number | null = null;
    for (const p of unassigned) {
      // gap-computed like anyone else: losing a framework must not hide a gap
      const { status, items } = computePersonGaps(p, today, unassignedWatches.get(p.id) ?? NO_WATCHES);
      people.push({
        id: p.id,
        name: p.fullName,
        status,
        hasUnwatchedOverdue: items.some((i) => i.level === "OVERDUE" && !i.watched),
      });
      overdueEvents += items.filter((i) => i.level === "OVERDUE").length;
      approachingEvents += items.filter((i) => i.level === "APPROACHING").length;
      const watchedItems = items.filter((i) => i.level === "OVERDUE" && i.watched);
      watchedEvents += watchedItems.length;
      for (const i of watchedItems) {
        oldestWatchDays = Math.max(oldestWatchDays ?? 0, i.watchAgeDays ?? 0);
      }
    }
    const node: GapTreeNode = {
      id: UNASSIGNED_NODE_ID,
      name: UNASSIGNED_NODE_NAME,
      kind: "TEAM", // people hang on it, and collapse-all-teams naturally includes it
      level: null,
      commander: null,
      total: people.length,
      red: people.filter((p) => p.status === "OVERDUE").length,
      yellow: people.filter((p) => p.status === "APPROACHING").length,
      overdueEvents,
      approachingEvents,
      watchedEvents,
      oldestWatchDays,
      people: people.sort((a, b) => a.name.localeCompare(b.name, "he")),
      children: [],
    };
    centerRoot.children.push(node); // last among the center's children, deliberately
    centerRoot.total += node.total;
    centerRoot.red += node.red;
    centerRoot.yellow += node.yellow;
    centerRoot.overdueEvents += node.overdueEvents;
    centerRoot.approachingEvents += node.approachingEvents;
    centerRoot.watchedEvents += node.watchedEvents;
    if (node.oldestWatchDays != null) {
      centerRoot.oldestWatchDays = Math.max(centerRoot.oldestWatchDays ?? 0, node.oldestWatchDays);
    }
  }

  return roots;
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
/**
 * Does this person belong in a list of PROBLEMS under this kind? Green people
 * never do.
 *
 * Takes the person rather than their level: «אי-עמידה שאינה במעקב» is a question
 * about items, and a level cannot answer it.
 */
export function isAttention(person: { status: GapLevel | null; hasUnwatchedOverdue: boolean }, kind: GapKind): boolean {
  const { status } = person;
  if (status !== "OVERDUE" && status !== "APPROACHING") return false;
  if (kind === "all") return true;
  if (kind === "approaching") return status === "APPROACHING";
  if (kind === "overdue") return status === "OVERDUE";
  // A narrowing of `overdue`, never a separate state: someone whose every
  // overdue item is acknowledged drops out here and stays red everywhere else.
  return status === "OVERDUE" && person.hasUnwatchedOverdue;
}

/** Does this person belong in the TREE's list of a team's people under this kind? */
export function belongsInTree(person: { status: GapLevel | null; hasUnwatchedOverdue: boolean }, kind: GapKind): boolean {
  if (kind === "all") return true; // the tree is a roster, not a problem list
  return isAttention(person, kind);
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
      if (isAttention(p, kind)) {
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
    people: n.people.filter((p) => belongsInTree(p, kind)),
    children: n.children.map(narrow),
  });
  return roots.map(narrow);
}
