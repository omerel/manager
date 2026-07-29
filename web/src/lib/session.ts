import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/access";

const COOKIE = "uid";

/**
 * The "current user". Real authentication is deferred (task 0.2); for the
 * skeleton the active user is chosen via a cookie so we can demonstrate how
 * access scope changes the entire view. Falls back to the first admin.
 */
export async function getSessionUser(): Promise<SessionUser> {
  const jar = await cookies();
  const uid = jar.get(COOKIE)?.value;

  const user =
    (uid ? await prisma.user.findUnique({ where: { id: uid }, include: { grants: true } }) : null) ??
    (await prisma.user.findFirst({ where: { role: "ADMIN" }, include: { grants: true } })) ??
    (await prisma.user.findFirst({ include: { grants: true } }));

  if (!user) {
    throw new Error("No users seeded. Run the database seed first.");
  }

  return {
    id: user.id,
    name: user.name,
    role: user.role,
    grants: user.grants.map((g) => ({ nodeId: g.nodeId, level: g.level })),
  };
}

export const SESSION_COOKIE = COOKIE;
