"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/authz";
import { saveUpload } from "@/lib/storage";
import { setLogoPath, setSystemName } from "@/lib/branding";

export async function updateSystemName(formData: FormData) {
  await requireAdmin();
  await setSystemName(String(formData.get("systemName") ?? ""));
  revalidatePath("/", "layout");
}

export async function uploadLogo(formData: FormData) {
  await requireAdmin();
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) throw new Error("לא נבחרה תמונה.");
  if (!file.type.startsWith("image/")) throw new Error("יש להעלות קובץ תמונה.");
  const { storagePath } = await saveUpload("branding", file);
  await setLogoPath(storagePath);
  revalidatePath("/", "layout");
}

export async function resetLogo() {
  await requireAdmin();
  await setLogoPath(null);
  revalidatePath("/", "layout");
}
