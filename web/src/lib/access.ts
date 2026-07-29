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

export type Visibility = {
  /** All node ids the user may see (union of granted subtrees; whole tree for admins). */
  nodeIds: Set<string>;
  /** Effective access level per visible node id. */
  levelOf: (nodeId: string) => AccessLevel | null;
  canEdit: (nodeId: string) => boolean;
  isAdmin: boolean;
};

/**
 * Access is a position in the tree, not a permission list.
 * Visibility = union of the subtrees rooted at the user's granted nodes,
 * with the level applied per subtree (EDIT wins over VIEW on overlap).
 * Admins see the whole tree with EDIT.
 */
export async function computeVisibility(user: SessionUser): Promise<Visibility> {
  const nodes = await loadNodes();
  const subtree = buildSubtreeIndex(nodes);

  const nodeIds = new Set<string>();
  const level = new Map<string, AccessLevel>();

  if (user.role === "ADMIN") {
    for (const n of nodes) {
      nodeIds.add(n.id);
      level.set(n.id, "EDIT");
    }
  } else {
    for (const grant of user.grants) {
      for (const id of subtree.get(grant.nodeId) ?? []) {
        nodeIds.add(id);
        const current = level.get(id);
        if (!current || LEVEL_RANK[grant.level] > LEVEL_RANK[current]) {
          level.set(id, grant.level);
        }
      }
    }
  }

  return {
    nodeIds,
    levelOf: (id) => level.get(id) ?? null,
    canEdit: (id) => level.get(id) === "EDIT",
    isAdmin: user.role === "ADMIN",
  };
}
