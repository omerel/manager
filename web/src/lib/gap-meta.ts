/**
 * Client-safe gap vocabulary. Kept out of `@/lib/gaps`, which reaches the
 * database through person-view and therefore cannot be imported from a client
 * component.
 */

// 🟢 met · ⬜ future · 🟡 approaching · 🔴 overdue-and-short/missed
export type GapLevel = "MET" | "FUTURE" | "APPROACHING" | "OVERDUE";

/**
 * Sentinel id of the dashboard's synthetic «לא משויכים» node. Lives here, in
 * the client-safe module, because the client tree must recognize it — a value
 * import from gap-dashboard.ts would drag prisma into the client bundle.
 * A cuid can never collide with it.
 */
export const UNASSIGNED_NODE_ID = "unassigned";
export const UNASSIGNED_NODE_NAME = "לא משויכים";

export const GAP_META: Record<GapLevel, { icon: string; label: string; badge: string; dot: string }> = {
  MET: { icon: "🟢", label: "תקין", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  FUTURE: { icon: "⬜", label: "עתידי", badge: "bg-stone-100 text-stone-600", dot: "bg-stone-300" },
  APPROACHING: { icon: "🟡", label: "מתקרב", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  OVERDUE: { icon: "🔴", label: "פיגור", badge: "bg-red-100 text-red-700", dot: "bg-red-500" },
};
