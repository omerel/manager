"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { logActivity } from "@/lib/activity-log";
import { hashPassword } from "@/lib/password";
import type { AccessLevel, Role } from "@/generated/prisma/client";

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

export async function createUser(formData: FormData) {
  await requireAdmin();
  const name = str(formData.get("name")) || "משתמש";
  const email = str(formData.get("email"));
  const password = str(formData.get("password"));
  const role = (str(formData.get("role")) === "ADMIN" ? "ADMIN" : "MANAGER") as Role;
  if (!name) throw new Error("חובה להזין שם.");
  if (!email) throw new Error("חובה להזין אימייל.");
  if (!password) throw new Error("חובה להזין סיסמה.");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("כבר קיים משתמש עם אימייל זה.");

  const username = await uniqueUsername(email);
  const created = await prisma.user.create({ data: { name, email, username, passwordHash: hashPassword(password), role } });
  await logActivity({ action: "user.create", description: `יצר משתמש ${name} (${role === "ADMIN" ? "אדמין" : "מנהל"})`, subjectType: "user", subjectId: created.id });
  revalidatePath("/access");
  revalidatePath("/", "layout"); // refresh the header's user list
}

/** Admin edit of a user's name/email. The username (login id) stays stable. */
export async function updateUserProfile(formData: FormData) {
  await requireAdmin();
  const userId = str(formData.get("userId"));
  const name = str(formData.get("name"));
  const email = str(formData.get("email"));
  if (!name || !email) throw new Error("חובה להזין שם ואימייל.");
  const clash = await prisma.user.findFirst({ where: { email, id: { not: userId } } });
  if (clash) throw new Error("כבר קיים משתמש עם אימייל זה.");
  await prisma.user.update({ where: { id: userId }, data: { name, email } });
  await logActivity({ action: "user.update", description: `ערך את פרטי המשתמש ${name}`, subjectType: "user", subjectId: userId });
  revalidatePath("/access");
  revalidatePath("/", "layout");
  redirect("/access");
}

export async function deleteUser(formData: FormData) {
  const me = await requireAdmin();
  const id = str(formData.get("userId"));
  if (id === me.id) throw new Error("לא ניתן למחוק את המשתמש הפעיל.");
  const doomed = await prisma.user.findUnique({ where: { id }, select: { name: true } });
  await prisma.user.delete({ where: { id } }); // grants cascade
  await logActivity({ action: "user.delete", description: `מחק את המשתמש ${doomed?.name ?? id}`, subjectType: "user", subjectId: id });
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
  await prisma.accessGrant.delete({ where: { id } });
  await logActivity({
    action: "grant.remove",
    description: `הסיר הרשאה של ${g?.user.name ?? "משתמש"} על ${g?.node.name ?? "מסגרת"}`,
    subjectType: "user",
  });
  revalidatePath("/access");
  revalidatePath("/", "layout");
}
