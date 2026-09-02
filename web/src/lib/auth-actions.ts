"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { requireAdmin } from "@/lib/authz";
import { logActivity, logLogin } from "@/lib/activity-log";
import { hashPassword, verifyPassword } from "@/lib/password";
import { SESSION_COOKIE, SESSION_TTL_MS, createSessionToken } from "@/lib/auth";

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

async function setSessionCookie(userId: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

/** Sign in with username OR email + password. Generic error, no user enumeration. */
export async function login(formData: FormData) {
  const identifier = str(formData.get("identifier"));
  const password = str(formData.get("password"));
  if (!identifier || !password) redirect("/login?error=1");

  const user = await prisma.user.findFirst({
    where: { OR: [{ username: identifier }, { email: identifier }] },
  });
  // a user without a stored hash cannot sign in (admin must set a password)
  if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
    redirect("/login?error=1");
  }

  await logLogin(user); // before the redirect throws its control-flow error
  await setSessionCookie(user.id);
  redirect("/");
}

export async function logout() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}

/** Self-service password change: requires the current password. */
export async function changeMyPassword(formData: FormData) {
  const me = await getSessionUser();
  const current = str(formData.get("current"));
  const next = str(formData.get("next"));
  if (next.length < 6) throw new Error("סיסמה חדשה קצרה מדי (מינימום 6 תווים).");

  const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!user.passwordHash || !verifyPassword(current, user.passwordHash)) {
    redirect("/account?error=1");
  }
  await prisma.user.update({ where: { id: me.id }, data: { passwordHash: hashPassword(next) } });
  redirect("/account?changed=1");
}

/** Admin reset: sets a new password without the old one (onboarding / forgot-password). */
export async function adminResetPassword(formData: FormData) {
  await requireAdmin();
  const userId = str(formData.get("userId"));
  const next = str(formData.get("password"));
  if (next.length < 6) throw new Error("סיסמה קצרה מדי (מינימום 6 תווים).");
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: hashPassword(next) } });
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  // the act is recorded; the password itself never is
  await logActivity({ action: "user.reset-password", description: `איפס סיסמה של ${target?.name ?? userId}`, subjectType: "user", subjectId: userId });
  revalidatePath("/access");
}
