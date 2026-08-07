import type { Role } from "@/generated/prisma/client";

/**
 * What each role is called on screen.
 *
 * Client-safe on purpose (no prisma import beyond the type), because the header
 * and the user switcher are client components.
 *
 * This exists because the label was written four times as
 * `role === "ADMIN" ? "אדמין" : "מנהל"` — a ternary that is exactly right for
 * two roles and silently wrong for three: every one of those four screens would
 * have called משא״ן a מנהל, and nothing would have failed.
 */
export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "אדמין",
  MANAGER: "מנהל",
  HR: "משא״ן",
};

export function roleLabel(role: Role | string): string {
  return ROLE_LABEL[role as Role] ?? String(role);
}
