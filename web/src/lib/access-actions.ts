"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
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
  await prisma.user.create({ data: { name, email, username, passwordHash: hashPassword(password), role } });
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
  revalidatePath("/access");
  revalidatePath("/", "layout");
  redirect("/access");
}

export async function deleteUser(formData: FormData) {
  const me = await requireAdmin();
  const id = str(formData.get("userId"));
  if (id === me.id) throw new Error("לא ניתן למחוק את המשתמש הפעיל.");
  await prisma.user.delete({ where: { id } }); // grants cascade
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
  revalidatePath("/access");
  revalidatePath("/", "layout");
}

export async function removeGrant(formData: FormData) {
  await requireAdmin();
  const id = str(formData.get("grantId"));
  await prisma.accessGrant.delete({ where: { id } });
  revalidatePath("/access");
  revalidatePath("/", "layout");
}
