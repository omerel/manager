import type { OrgNode, Role } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { computeVisibility, type Grant } from "@/lib/access";

/**
 * Framework command: who is responsible for a framework, as opposed to who can
 * see it.
 *
 * The relationship between the two is deliberately asymmetric, and both halves
 * matter:
 *
 *   command REQUIRES access  — a user cannot be made commander of a framework
 *                              they cannot see, enforced here
 *   command CONFERS none     — appointing creates no grant and widens no
 *                              visibility; `computeVisibility` remains a
 *                              function of AccessGrant alone
 *
 * So this module READS visibility and never writes it. If you find yourself
 * about to create an AccessGrant here, the design decision has been lost.
 *
 * The condition is checked against effective visibility rather than an exact
 * node match: a grant over a domain qualifies every section and team beneath
 * it, because the user can already see them. Either level satisfies it — the
 * question is whether the framework is in view, not what they may do there.
 */

/** A framework, labelled by its full path through the tree. */
export type FrameworkOption = { id: string; path: string };

/** `מרכז ▸ תחום ▸ מדור` — names repeat between branches, so paths are the only safe label. */
export function pathResolver(nodes: Pick<OrgNode, "id" | "name" | "parentId">[]) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return (id: string | null | undefined): string => {
    if (!id) return "";
    const parts: string[] = [];
    let cur = byId.get(id);
    while (cur) {
      parts.unshift(cur.name);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return parts.join(" ▸ ");
  };
}

/** Every framework, all four kinds, labelled by path and sorted in Hebrew. */
export async function frameworkOptions(): Promise<FrameworkOption[]> {
  const nodes = await prisma.orgNode.findMany();
  const resolve = pathResolver(nodes);
  return nodes
    .map((n) => ({ id: n.id, path: resolve(n.id) }))
    .sort((a, b) => a.path.localeCompare(b.path, "he"));
}

/** The same list, narrowed to what one user can already see — what they may be given to command. */
export async function commandableBy(role: Role, grants: Grant[]): Promise<FrameworkOption[]> {
  const visibility = await computeVisibility({ id: "", name: "", role, grants });
  return (await frameworkOptions()).filter((o) => visibility.nodeIds.has(o.id));
}

/** Is this framework within reach of a user holding exactly these grants? */
export async function canCommand(role: Role, grants: Grant[], nodeId: string): Promise<boolean> {
  const visibility = await computeVisibility({ id: "", name: "", role, grants });
  return visibility.nodeIds.has(nodeId);
}

/**
 * Refuse an appointment that would outrun the user's access.
 *
 * Takes the grants explicitly rather than reading them, because the caller that
 * needs it most — creating a user — is deciding about grants that do not exist
 * in the database yet.
 */
export async function assertCanCommand(role: Role, grants: Grant[], nodeId: string, opts?: { atCreation?: boolean }) {
  if (await canCommand(role, grants, nodeId)) return;
  const nodes = await prisma.orgNode.findMany();
  const path = pathResolver(nodes)(nodeId) || "המסגרת שנבחרה";
  throw new Error(
    opts?.atCreation
      ? `לא ניתן למנות מפקד על ${path}: המסגרת אינה בתוך ההרשאה הראשונה שנבחרה. בחר הרשאה שמכסה אותה, או השאר את שדה הפיקוד ריק.`
      : `לא ניתן למנות מפקד על ${path}: למשתמש אין הרשאה על המסגרת. תן לו הרשאה תחילה, ואז מנה אותו.`,
  );
}

/** The commanded framework's path, for messages and display. Empty string when none. */
export async function commandedPath(nodeId: string | null): Promise<string> {
  if (!nodeId) return "";
  const nodes = await prisma.orgNode.findMany();
  return pathResolver(nodes)(nodeId);
}

/**
 * Refuse a framework that is already commanded, naming who holds it.
 *
 * The unique index is what actually guarantees one commander per framework —
 * two Admins submitting in the same moment would both pass this check. This
 * exists for the message, not for the guarantee, which is why the caller must
 * ALSO translate the unique violation: both paths must read identically to the
 * person at the screen.
 */
export async function assertFrameworkFree(nodeId: string, exceptUserId?: string) {
  const holder = await prisma.user.findUnique({ where: { commandsNodeId: nodeId }, select: { id: true, name: true } });
  if (!holder || holder.id === exceptUserId) return;
  throw new Error(await frameworkTakenMessage(nodeId, holder.name));
}

/** The one wording for "already commanded", used by the check and by the P2002 translation alike. */
export async function frameworkTakenMessage(nodeId: string, holderName?: string): Promise<string> {
  const path = (await commandedPath(nodeId)) || "המסגרת שנבחרה";
  const holder = holderName ?? (await prisma.user.findUnique({ where: { commandsNodeId: nodeId }, select: { name: true } }))?.name;
  return `המסגרת ״${path}״ כבר מפוקדת${holder ? ` על ידי ${holder}` : ""}. כדי להחליף מפקד, יש להסיר את הפיקוד ממנו תחילה.`;
}

/**
 * True when an error is the unique-index violation on the command column.
 *
 * The offending field is read out of the error's metadata rather than from a
 * fixed path, because there isn't one: with the `PrismaPg` driver adapter a
 * P2002 carries no `meta.target` at all — the columns arrive quoted, nested at
 * `meta.driverAdapterError.cause.constraint.fields`, alongside the raw
 * `duplicate key value violates unique constraint "User_commandsNodeId_key"`.
 * Serialising the metadata and looking for the column name survives both
 * shapes, and the check is still specific: a clash on `email` or `username`
 * does not mention this column and correctly falls through to its own error.
 */
export function isCommandConflict(e: unknown): boolean {
  const err = e as { code?: string; meta?: unknown };
  if (err?.code !== "P2002") return false;
  try {
    return JSON.stringify(err.meta ?? "").includes("commandsNodeId");
  } catch {
    return false;
  }
}

/**
 * Refuse a grant removal that would strand a commander.
 *
 * Rather than testing subtree containment, this recomputes what the user would
 * see WITHOUT the doomed grant and asks whether the commanded framework is
 * still in view. That answers "does another grant still cover it?" for free,
 * and it answers it with the same code that decides visibility everywhere else
 * — so the two can never disagree.
 */
export async function assertGrantIsRemovable(grantId: string) {
  const grant = await prisma.accessGrant.findUnique({
    where: { id: grantId },
    select: { userId: true, user: { select: { role: true, commandsNodeId: true, grants: { select: { nodeId: true, level: true } } } } },
  });
  const commandsNodeId = grant?.user.commandsNodeId;
  if (!grant || !commandsNodeId) return;

  const remaining = await prisma.accessGrant.findMany({
    where: { userId: grant.userId, id: { not: grantId } },
    select: { nodeId: true, level: true },
  });
  if (await canCommand(grant.user.role, remaining, commandsNodeId)) return;

  const path = await commandedPath(commandsNodeId);
  throw new Error(
    `לא ניתן להסיר את ההרשאה: המשתמש מפקד על ${path}, וללא הרשאה זו הוא לא יראה אותה. הסר קודם את הפיקוד, או תן הרשאה אחרת שמכסה את המסגרת.`,
  );
}
