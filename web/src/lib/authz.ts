import { getSessionUser } from "@/lib/session";
import { computeVisibility } from "@/lib/access";

/** Throw unless the active user is the Admin (אדמין). Use to guard configuration. */
export async function requireAdmin() {
  const user = await getSessionUser();
  if (user.role !== "ADMIN") {
    throw new Error("פעולה זו מותרת לאדמין בלבד.");
  }
  return user;
}

export async function isAdmin(): Promise<boolean> {
  const user = await getSessionUser();
  return user.role === "ADMIN";
}

/** Throw unless the active user has EDIT on the given node (manual data entry). */
export async function requireEditForNode(nodeId: string) {
  const user = await getSessionUser();
  const visibility = await computeVisibility(user);
  if (!visibility.canEdit(nodeId)) {
    throw new Error("אין לך הרשאת עריכה למסגרת זו.");
  }
  return user;
}

/** Throw unless the active user may edit this person. Unassigned people (no team) are admin-only. */
export async function requireEditForPerson(personId: string) {
  const { prisma } = await import("@/lib/prisma");
  const p = await prisma.person.findUnique({ where: { id: personId }, select: { teamId: true } });
  if (!p) throw new Error("איש לא נמצא.");
  if (!p.teamId) return requireAdmin();
  return requireEditForNode(p.teamId);
}
