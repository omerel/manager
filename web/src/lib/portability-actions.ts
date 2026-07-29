"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/authz";
import { importBundleBuffer } from "@/lib/portability";

export async function importBundle(formData: FormData) {
  await requireAdmin();

  // no confirmation → nothing is imported (spec)
  if (String(formData.get("confirm") ?? "") !== "on") {
    redirect("/system?importError=" + encodeURIComponent("יש לאשר את תיבת האישור לפני ייבוא."));
  }
  const file = formData.get("bundle");
  if (!(file instanceof File) || file.size === 0) {
    redirect("/system?importError=" + encodeURIComponent("לא נבחר קובץ."));
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const result = await importBundleBuffer(buf);
    revalidatePath("/", "layout");
    redirect(
      "/system?imported=" +
        encodeURIComponent(
          `${result.scope === "full" ? "שחזור מלא" : "ייבוא תצורה"} הושלם: ${result.counts.nodes} מסגרות · ${result.counts.plans} תכניות · ${result.counts.users} משתמשים · ${result.counts.people} אנשים · ${result.files} קבצים`,
        ),
    );
  } catch (e) {
    // redirect() throws NEXT_REDIRECT — let it through
    if (e && typeof e === "object" && "digest" in e && String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) throw e;
    redirect("/system?importError=" + encodeURIComponent(e instanceof Error ? e.message : "ייבוא נכשל."));
  }
}
