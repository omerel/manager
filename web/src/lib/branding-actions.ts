"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/authz";
import { saveUpload, deleteUpload } from "@/lib/storage";
import { getLogoPath, setLogoPath, setSystemName } from "@/lib/branding";

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
  const previous = await getLogoPath();
  const { storagePath } = await saveUpload("branding", file);
  await setLogoPath(storagePath);
  await deleteUpload(previous); // the replaced logo is unreferenced from here on
  revalidatePath("/", "layout");
}

export async function resetLogo() {
  await requireAdmin();
  const previous = await getLogoPath();
  await setLogoPath(null);
  await deleteUpload(previous);
  revalidatePath("/", "layout");
}
