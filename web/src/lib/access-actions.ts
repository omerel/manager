"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { logActivity } from "@/lib/activity-log";
import { hashPassword } from "@/lib/password";
import {
  assertCanCommand,
  assertFrameworkFree,
  assertGrantIsRemovable,
  commandedPath,
  frameworkTakenMessage,
  isCommandConflict,
} from "@/lib/commander";
import type { AccessLevel, Role } from "@/generated/prisma/client";
import { roleLabel } from "@/lib/role-labels";

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

/** Derive a unique username from the email prefix (before @), suffixing on collision. */
async function uniqueUsername(email: string): Promise<string> {
  const base = (email.split("@")[0] || "user").toLowerCase();
  let candidate = base;
  let n = 1;
  while (await prisma.user.findUnique({ where: { username: candidate } })) {
    candidate = `${base}${n++}`;
  }
  return candidate;
}

/**
 * Create a user, optionally with a first access grant and a commanded framework.
 *
 * The first grant is here for one reason: a new user has no grants at all, and
 * a command may not be given to someone who cannot see the framework. Without a
 * grant in the same form, the command field could never be filled at creation —
 * it would be a field that only ever refuses. The grant stays optional; a user
 * with no access is still a legitimate thing to create.
 */
export async function createUser(formData: FormData) {
  await requireAdmin();
  const name = str(formData.get("name")) || "משתמש";
  const email = str(formData.get("email"));
  const password = str(formData.get("password"));
  // an unknown value falls back to MANAGER, the least powerful of the three
  const requested = str(formData.get("role"));
  const role = (requested === "ADMIN" || requested === "HR" ? requested : "MANAGER") as Role;
  const grantNodeId = str(formData.get("grantNodeId"));
  const grantLevel = (str(formData.get("grantLevel")) === "EDIT" ? "EDIT" : "VIEW") as AccessLevel;
  const commandsNodeId = str(formData.get("commandsNodeId")) || null;
  if (!name) throw new Error("חובה להזין שם.");
  if (!email) throw new Error("חובה להזין אימייל.");
  if (!password) throw new Error("חובה להזין סיסמה.");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("כבר קיים משתמש עם אימייל זה.");

  if (commandsNodeId) {
    const node = await prisma.orgNode.findUnique({ where: { id: commandsNodeId }, select: { id: true } });
    if (!node) throw new Error("המסגרת שנבחרה לפיקוד אינה קיימת.");
    await assertFrameworkFree(commandsNodeId);
    // The prospective grants, not the stored ones — there are none yet.
    await assertCanCommand(role, grantNodeId ? [{ nodeId: grantNodeId, level: grantLevel }] : [], commandsNodeId, { atCreation: true });
  }

  const username = await uniqueUsername(email);
  let created;
  try {
    // One transaction: a user who was supposed to arrive with access and
    // responsibility must not arrive with only some of it.
    created = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { name, email, username, passwordHash: hashPassword(password), role, commandsNodeId },
      });
      if (grantNodeId) await tx.accessGrant.create({ data: { userId: u.id, nodeId: grantNodeId, level: grantLevel } });
      return u;
    });
  } catch (e) {
    // Two Admins in the same moment: the index refused, and the message must
    // match the one the ordinary check produces.
    if (commandsNodeId && isCommandConflict(e)) throw new Error(await frameworkTakenMessage(commandsNodeId));
    throw e;
  }

  await logActivity({ action: "user.create", description: `יצר משתמש ${name} (${roleLabel(role)})`, subjectType: "user", subjectId: created.id });
  if (grantNodeId) {
    const n = await prisma.orgNode.findUnique({ where: { id: grantNodeId }, select: { name: true } });
    await logActivity({
      action: "grant.add",
      description: `נתן ל${name} הרשאת ${grantLevel === "EDIT" ? "עריכה" : "צפייה"} על ${n?.name ?? grantNodeId}`,
      subjectType: "user",
      subjectId: created.id,
    });
  }
  if (commandsNodeId) {
    await logActivity({
      action: "user.command.set",
      description: `מינה את ${name} למפקד ${await commandedPath(commandsNodeId)}`,
      subjectType: "user",
      subjectId: created.id,
    });
  }
  revalidatePath("/access");
  revalidatePath("/", "layout"); // refresh the header's user list
}

/**
 * Admin edit of a user's name, email and commanded framework. The username
 * (login id) stays stable, and so does the role: there is no path in the system
 * that changes a role after creation, which is what keeps an Admin — who sees
 * the whole tree — from silently losing sight of the framework they command.
 */
export async function updateUserProfile(formData: FormData) {
  await requireAdmin();
  const userId = str(formData.get("userId"));
  const name = str(formData.get("name"));
  const email = str(formData.get("email"));
  if (!name || !email) throw new Error("חובה להזין שם ואימייל.");
  const clash = await prisma.user.findFirst({ where: { email, id: { not: userId } } });
  if (clash) throw new Error("כבר קיים משתמש עם אימייל זה.");

  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, commandsNodeId: true, grants: { select: { nodeId: true, level: true } } },
  });
  if (!before) throw new Error("משתמש לא נמצא.");

  // Absent field → leave the command alone; present but empty → clear it.
  const commandTouched = formData.has("commandsNodeId");
  const commandsNodeId = commandTouched ? str(formData.get("commandsNodeId")) || null : before.commandsNodeId;
  const commandChanged = commandsNodeId !== before.commandsNodeId;

  if (commandChanged && commandsNodeId) {
    const node = await prisma.orgNode.findUnique({ where: { id: commandsNodeId }, select: { id: true } });
    if (!node) throw new Error("המסגרת שנבחרה לפיקוד אינה קיימת.");
    await assertFrameworkFree(commandsNodeId, userId);
    await assertCanCommand(before.role, before.grants, commandsNodeId);
  }

  try {
    await prisma.user.update({ where: { id: userId }, data: { name, email, commandsNodeId } });
  } catch (e) {
    if (commandsNodeId && isCommandConflict(e)) throw new Error(await frameworkTakenMessage(commandsNodeId));
    throw e;
  }

  await logActivity({ action: "user.update", description: `ערך את פרטי המשתמש ${name}`, subjectType: "user", subjectId: userId });
  if (commandChanged) {
    await logActivity(
      commandsNodeId
        ? { action: "user.command.set", description: `מינה את ${name} למפקד ${await commandedPath(commandsNodeId)}`, subjectType: "user", subjectId: userId }
        : { action: "user.command.clear", description: `הסיר מ${name} את הפיקוד על ${await commandedPath(before.commandsNodeId)}`, subjectType: "user", subjectId: userId },
    );
  }
  revalidatePath("/access");
  revalidatePath("/", "layout");
  redirect("/access");
}

/**
 * Delete a user.
 *
 * Queries they sent AS A PERSON are closed first. `authorId` is `SetNull`, which
 * is right for a framework query — the framework carries it and it outlives
 * whoever typed it — but a lateral query has no framework behind it, so nulling
 * the author would leave a question nobody can close, edit or delete, sitting
 * open in every recipient's panel forever. Deleting them outright was the other
 * option and is worse: the answers commanders wrote are their work, not the
 * sender's. So the correspondence closes and stays readable.
 *
 * Queries their FRAMEWORK sent are deliberately untouched, and pass to whoever
 * commands it next.
 */
export async function deleteUser(formData: FormData) {
  const me = await requireAdmin();
  const id = str(formData.get("userId"));
  if (id === me.id) throw new Error("לא ניתן למחוק את המשתמש הפעיל.");
  const doomed = await prisma.user.findUnique({ where: { id }, select: { name: true } });
  const closed = await prisma.query.updateMany({
    where: { senderKind: "STAFF", authorId: id, closedAt: null },
    data: { closedAt: new Date() },
  });
  await prisma.user.delete({ where: { id } }); // grants cascade
  await logActivity({
    action: "user.delete",
    // the count is named because after the delete the actor cannot go and look
    description:
      `מחק את המשתמש ${doomed?.name ?? id}` + (closed.count ? ` · נסגרו ${closed.count} שאילתות שהוא שלח` : ""),
    subjectType: "user",
    subjectId: id,
  });
  revalidatePath("/access");
  revalidatePath("/", "layout");
}

export async function addGrant(formData: FormData) {
  await requireAdmin();
  const userId = str(formData.get("userId"));
  const nodeId = str(formData.get("nodeId"));
  const level = (str(formData.get("level")) === "EDIT" ? "EDIT" : "VIEW") as AccessLevel;
  if (!userId || !nodeId) throw new Error("חסר משתמש או מסגרת.");

  // One grant per (user, node); re-granting updates the level.
  await prisma.accessGrant.upsert({
    where: { userId_nodeId: { userId, nodeId } },
    create: { userId, nodeId, level },
    update: { level },
  });
  const [u, n] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    prisma.orgNode.findUnique({ where: { id: nodeId }, select: { name: true } }),
  ]);
  await logActivity({
    action: "grant.add",
    description: `נתן ל${u?.name ?? userId} הרשאת ${level === "EDIT" ? "עריכה" : "צפייה"} על ${n?.name ?? nodeId}`,
    subjectType: "user",
    subjectId: userId,
  });
  revalidatePath("/access");
  revalidatePath("/", "layout");
}

export async function removeGrant(formData: FormData) {
  await requireAdmin();
  const id = str(formData.get("grantId"));
  // read before the delete: afterwards there is nothing to name
  const g = await prisma.accessGrant.findUnique({
    where: { id },
    select: { user: { select: { name: true } }, node: { select: { name: true } } },
  });
  // A commander must be able to see what they command. Removing the grant that
  // makes that true is refused while the command stands — the Admin clears the
  // command first, deliberately, rather than as a side effect of this form.
  await assertGrantIsRemovable(id);
  await prisma.accessGrant.delete({ where: { id } });
  await logActivity({
    action: "grant.remove",
    description: `הסיר הרשאה של ${g?.user.name ?? "משתמש"} על ${g?.node.name ?? "מסגרת"}`,
    subjectType: "user",
  });
  revalidatePath("/access");
  revalidatePath("/", "layout");
}
