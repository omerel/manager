import type { AccessLevel, OrgKind } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { Visibility } from "@/lib/access";
import { bySiblingOrder, commandersClashMessage } from "@/lib/org-nesting";
import { pathOf } from "@/lib/movements";

/**
 * A commanders framework's name is unique across the WHOLE system, not merely
 * among its siblings — the name is what the HR importer resolves a person's
 * framework by, and «מפקדים מדור תשתיות» in two branches is exactly the
 * ambiguity the naming convention exists to avoid.
 *
 * Deliberately narrow: ordinary frameworks may go on repeating names between
 * branches, as they always have. Widening it would retroactively condemn an
 * existing org for something that was legal yesterday.
 *
 * Here rather than in `org-actions`, which is `"use server"` and can therefore
 * export nothing but actions — this rule guards two of them and must be
 * reachable on its own. `exceptId` is what makes it usable on a rename: a
 * framework does not collide with itself.
 *
 * Returns the refusal, naming WHERE the clash sits, or null if the name is free.
 */
export async function commandersNameClash(kind: OrgKind, name: string, exceptId: string | null): Promise<string | null> {
  if (kind !== "COMMANDERS") return null;
  const clash = await prisma.orgNode.findFirst({
    where: { kind: "COMMANDERS", name, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (!clash) return null;
  return commandersClashMessage(name, (await pathOf(clash.id)) ?? "");
}

export type OrgTreeNode = {
  id: string;
  name: string;
  kind: OrgKind;
  level: AccessLevel | null;
  directPeople: number; // people attached directly (only TEAM nodes have any)
  totalPeople: number; // rolled up across the subtree
  children: OrgTreeNode[];
};

export const KIND_LABEL: Record<OrgKind, string> = {
  CENTER: "מרכז",
  DOMAIN: "תחום",
  SECTION: "מדור",
  TEAM: "צוות",
  COMMANDERS: "מפקדים",
};

/**
 * Build the org forest the user can see (their granted subtrees), with a
 * headcount rolled up the tree. Headcount is the skeleton's first demonstrable
 * aggregation; the gap engine will later roll up the same way.
 */
export async function buildScopedTree(visibility: Visibility): Promise<OrgTreeNode[]> {
  const [nodes, people] = await Promise.all([
    prisma.orgNode.findMany(),
    prisma.person.findMany({ select: { teamId: true } }),
  ]);

  const visible = nodes.filter((n) => visibility.nodeIds.has(n.id));
  const visibleIds = new Set(visible.map((n) => n.id));

  const directCount = new Map<string, number>();
  for (const p of people) {
    if (p.teamId && visibleIds.has(p.teamId)) {
      directCount.set(p.teamId, (directCount.get(p.teamId) ?? 0) + 1);
    }
  }

  const childrenOf = new Map<string, typeof visible>();
  for (const n of visible) {
    if (n.parentId && visibleIds.has(n.parentId)) {
      const arr = childrenOf.get(n.parentId) ?? [];
      arr.push(n);
      childrenOf.set(n.parentId, arr);
    }
  }

  const build = (id: string): OrgTreeNode => {
    const node = visible.find((n) => n.id === id)!;
    const children = (childrenOf.get(id) ?? []).sort(bySiblingOrder).map((c) => build(c.id));
    const direct = directCount.get(id) ?? 0;
    const total = direct + children.reduce((sum, c) => sum + c.totalPeople, 0);
    return {
      id: node.id,
      name: node.name,
      kind: node.kind,
      level: visibility.levelOf(node.id),
      directPeople: direct,
      totalPeople: total,
      children,
    };
  };

  // Roots = visible nodes whose parent is not itself visible (top of each granted subtree).
  const roots = visible.filter((n) => !n.parentId || !visibleIds.has(n.parentId));
  return roots.sort(bySiblingOrder).map((r) => build(r.id));
}
