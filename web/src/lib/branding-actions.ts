"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity-log";
import { requireAdmin } from "@/lib/authz";
import { saveUpload, deleteUpload } from "@/lib/storage";
import { getLogoPath, setLogoPath, setSystemName, setLoginLink } from "@/lib/branding";

export async function updateSystemName(formData: FormData) {
  await requireAdmin();
  await setSystemName(String(formData.get("systemName") ?? ""));
  await logActivity({ action: "branding.name", description: "שינה את שם המערכת", subjectType: "system" });
  revalidatePath("/", "layout");
}

export async function uploadLogo(formData: FormData) {
  await requireAdmin();
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) throw new Error("לא נבחרה תמונה.");
  if (!file.type.startsWith("image/")) throw new Error("יש להעלות קובץ תמונה.");
  const previous = await getLogoPath();
  const { storagePath } = await saveUpload("branding", file);
  await setLogoPath(storagePath);
  await deleteUpload(previous); // the replaced logo is unreferenced from here on
  await logActivity({ action: "branding.logo", description: "עדכן את לוגו המערכת", subjectType: "system" });
  revalidatePath("/", "layout");
}

export async function resetLogo() {
  await requireAdmin();
  const previous = await getLogoPath();
  await setLogoPath(null);
  await deleteUpload(previous);
  await logActivity({ action: "branding.logo", description: "איפס את לוגו המערכת", subjectType: "system" });
  revalidatePath("/", "layout");
}

export async function updateLoginLink(formData: FormData) {
  await requireAdmin();
  const url = String(formData.get("loginLinkUrl") ?? "").trim();
  // the login page is shown to signed-OUT visitors — never let a non-http
  // scheme (javascript:, data:) through, even Admin-planted
  if (url && !/^https?:\/\/.+/i.test(url)) throw new Error("הקישור חייב להיות כתובת מלאה המתחילה ב-http:// או https://");
  await setLoginLink({
    text: String(formData.get("loginLinkText") ?? ""),
    url,
    enabled: formData.get("loginLinkEnabled") === "on",
  });
  await logActivity({ action: "branding.loginLink", description: "עדכן את קישור אתר הפיתוח במסך ההתחברות", subjectType: "system" });
  revalidatePath("/login");
  revalidatePath("/system");
}
