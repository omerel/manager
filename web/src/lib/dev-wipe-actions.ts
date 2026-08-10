"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity-log";
import { requireAdmin } from "@/lib/authz";
import { wipeCategories } from "@/lib/dev-wipe";
import { WIPE_CATEGORIES, type WipeCategory } from "@/lib/dev-wipe-categories";

export type WipeState = { ok: true; counts: { label: string; count: number }[] } | { ok: false; error: string } | null;

export async function devWipe(_prev: WipeState, formData: FormData): Promise<WipeState> {
  // the production check comes FIRST: on a shipped build this tool does not
  // exist, for any role, with any session
  if (process.env.NODE_ENV === "production") return { ok: false, error: "כלי פיתוח בלבד — אינו זמין בסביבת ייצור." };
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "פעולה זו מותרת לאדמין בלבד." };
  }

  const valid = new Set<string>(WIPE_CATEGORIES.map((c) => c.key));
  const keys = formData.getAll("category").map(String).filter((k) => valid.has(k)) as WipeCategory[];
  if (keys.length === 0) return { ok: false, error: "לא סומנה אף קטגוריה." };

  const counts = await wipeCategories(keys);
  await logActivity({
    action: "dev.wipe",
    description: `מחק נתוני פיתוח: ${counts.map((c) => `${c.count} ${c.label}`).join(", ")}`,
    subjectType: "system",
  });
  revalidatePath("/", "layout");
  return { ok: true, counts };
}
