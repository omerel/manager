import type { AccessLevel, OrgNode, Role } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// EDIT dominates VIEW when the same node is reachable via multiple grants.
const LEVEL_RANK: Record<AccessLevel, number> = { VIEW: 1, EDIT: 2 };

export type Grant = { nodeId: string; level: AccessLevel };

export type SessionUser = {
  id: string;
  name: string;
  role: Role;
  grants: Grant[];
};

/** All org nodes, used to walk the tree in memory (the tree is small). */
export async function loadNodes(): Promise<OrgNode[]> {
  return prisma.orgNode.findMany();
}

/** Map each node id to the ids of every node in its subtree (including itself). */
function buildSubtreeIndex(nodes: OrgNode[]): Map<string, Set<string>> {
  const childrenOf = new Map<string, string[]>();
  for (const n of nodes) {
    if (n.parentId) {
      const arr = childrenOf.get(n.parentId) ?? [];
      arr.push(n.id);
      childrenOf.set(n.parentId, arr);
    }
  }
  const subtree = new Map<string, Set<string>>();
  const collect = (id: string): Set<string> => {
    if (subtree.has(id)) return subtree.get(id)!;
    const set = new Set<string>([id]);
    for (const child of childrenOf.get(id) ?? []) {
      for (const d of collect(child)) set.add(d);
    }
    subtree.set(id, set);
    return set;
  };
  for (const n of nodes) collect(n.id);
  return subtree;
}

/** Node kinds at section level and above — the ranks that carry establishment authority. */
const ESTABLISHMENT_KINDS: ReadonlySet<string> = new Set(["SECTION", "DOMAIN", "CENTER"]);

export type Visibility = {
  /** All node ids the user may see (union of granted subtrees; whole tree for admins). */
  nodeIds: Set<string>;
  /** Effective access level per visible node id. */
  levelOf: (nodeId: string) => AccessLevel | null;
  canEdit: (nodeId: string) => boolean;
  /**
   * May the user perform an establishment act here — enrolling a person into
   * this framework, or removing one from it?
   *
   * Deliberately not called `canEditAt`: it answers a question `canEdit` cannot.
   * A grant spreads its level down its whole subtree, so `canEdit(team)` is
   * identical whether the grant sat on the team or on the section above it —
   * the level map remembers *what* you may do at a node, never *where* the
   * grant allowing it sits. This asks the second question: does the authority
   * come from a grant at section level or above?
   */
  mayEstablishAt: (nodeId: string) => boolean;
  isAdmin: boolean;
};

/**
 * Access is a position in the tree, not a permission list.
 * Visibility = union of the subtrees rooted at the user's granted nodes,
 * with the level applied per subtree (EDIT wins over VIEW on overlap).
 * Admins see the whole tree with EDIT.
 */
export async function computeVisibility(user: SessionUser): Promise<Visibility> {
  return visibilityFrom(await loadNodes(), user);
}

/**
 * The same computation, over nodes the caller has already loaded.
 *
 * Exists so a page that has the tree in hand can answer "what can this user
 * see?" for many users without a query each — and, more importantly, without a
 * second copy of the subtree walk. `computeVisibility` is now a thin wrapper on
 * this, so there is exactly one definition of visibility in the system.
 */
export function visibilityFrom(nodes: OrgNode[], user: SessionUser): Visibility {
  const subtree = buildSubtreeIndex(nodes);
  const kindOf = new Map(nodes.map((n) => [n.id, n.kind as string]));

  const nodeIds = new Set<string>();
  const level = new Map<string, AccessLevel>();
  // Establishment authority is computed in this same walk, not by a second
  // helper: a grant contributes to it only when the grant's OWN node is a
  // section or above and its level is EDIT. Same subtree, different question.
  const establish = new Set<string>();

  if (user.role === "ADMIN") {
    for (const n of nodes) {
      nodeIds.add(n.id);
      level.set(n.id, "EDIT");
      establish.add(n.id);
    }
  } else {
    for (const grant of user.grants) {
      const senior = grant.level === "EDIT" && ESTABLISHMENT_KINDS.has(kindOf.get(grant.nodeId) ?? "");
      for (const id of subtree.get(grant.nodeId) ?? []) {
        nodeIds.add(id);
        const current = level.get(id);
        if (!current || LEVEL_RANK[grant.level] > LEVEL_RANK[current]) {
          level.set(id, grant.level);
        }
        if (senior) establish.add(id);
      }
    }
  }

  return {
    nodeIds,
    levelOf: (id) => level.get(id) ?? null,
    canEdit: (id) => level.get(id) === "EDIT",
    mayEstablishAt: (id) => establish.has(id),
    isAdmin: user.role === "ADMIN",
  };
}
