"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import type { OrgKind } from "@/generated/prisma/client";

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

// Expected parent kind for each non-root kind.
const PARENT_KIND: Record<Exclude<OrgKind, "CENTER">, OrgKind> = {
  DOMAIN: "CENTER",
  SECTION: "DOMAIN",
  TEAM: "SECTION",
};

export async function addOrgNode(formData: FormData) {
  await requireAdmin();
  const name = str(formData.get("name"));
  const kind = str(formData.get("kind")) as OrgKind;
  const parentId = str(formData.get("parentId")) || null;
  if (!name) throw new Error("חובה להזין שם מסגרת.");
  if (!["CENTER", "DOMAIN", "SECTION", "TEAM"].includes(kind)) throw new Error("סוג מסגרת לא תקין.");

  if (kind === "CENTER") {
    await prisma.orgNode.create({ data: { name, kind, parentId: null } });
  } else {
    if (!parentId) throw new Error("יש לבחור מסגרת אב.");
    const parent = await prisma.orgNode.findUnique({ where: { id: parentId } });
    const expected = PARENT_KIND[kind as Exclude<OrgKind, "CENTER">];
    if (!parent || parent.kind !== expected) {
      throw new Error(`מסגרת אב חייבת להיות מסוג ${expected}.`);
    }
    await prisma.orgNode.create({ data: { name, kind, parentId } });
  }
  revalidatePath("/hierarchy");
  revalidatePath("/", "layout");
}

export async function removeOrgNode(formData: FormData) {
  await requireAdmin();
  const id = str(formData.get("id"));
  const node = await prisma.orgNode.findUnique({
    where: { id },
    include: { _count: { select: { children: true } } },
  });
  if (!node) throw new Error("מסגרת לא נמצאה.");
  // Sub-frameworks would be orphaned — block and require deleting them first.
  if (node._count.children > 0) throw new Error("לא ניתן למחוק מסגרת שיש תחתיה תת-מסגרות. מחק/י אותן קודם.");
  // People assigned to this node become unassigned (teamId → null via ON DELETE SET NULL);
  // grants on this node cascade-delete.
  await prisma.orgNode.delete({ where: { id } });
  revalidatePath("/hierarchy");
  revalidatePath("/people");
  revalidatePath("/", "layout");
}
