"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { SESSION_COOKIE } from "@/lib/session";

/** Skeleton-only: switch the active user (stands in for real auth, task 0.2). */
export async function setActiveUser(uid: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, uid, { httpOnly: true, sameSite: "lax", path: "/" });
  revalidatePath("/", "layout");
}
