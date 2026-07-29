import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import type { SessionUser } from "@/lib/access";

/**
 * The signed-in user, or null when the session cookie is missing, tampered,
 * or expired. Use this variant in data routes (401/404) and the header.
 */
export async function getSessionUserOrNull(): Promise<SessionUser | null> {
  const jar = await cookies();
  const userId = verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!userId) return null;

  const user = await prisma.user.findUnique({ where: { id: userId }, include: { grants: true } });
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    role: user.role,
    grants: user.grants.map((g) => ({ nodeId: g.nodeId, level: g.level })),
  };
}

/**
 * The signed-in user. The single enforcement point for pages and actions:
 * with no valid session, redirects to /login (no fallback user).
 */
export async function getSessionUser(): Promise<SessionUser> {
  const user = await getSessionUserOrNull();
  if (!user) redirect("/login");
  return user;
}

export { SESSION_COOKIE };
