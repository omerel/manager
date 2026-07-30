"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import type { OrgKind } from "@/generated/prisma/client";

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

// Expected parent kind for each non-root kind, and the allowed child kind.
const PARENT_KIND: Record<Exclude<OrgKind, "CENTER">, OrgKind> = {
  DOMAIN: "CENTER",
  SECTION: "DOMAIN",
  TEAM: "SECTION",
};
const CHILD_KIND: Record<OrgKind, OrgKind | null> = {
  CENTER: "DOMAIN",
  DOMAIN: "SECTION",
  SECTION: "TEAM",
  TEAM: null,
};
const KIND_LABEL: Record<OrgKind, string> = { CENTER: "מרכז", DOMAIN: "תחום", SECTION: "מדור", TEAM: "צוות" };

function isKind(v: string): v is OrgKind {
  return ["CENTER", "DOMAIN", "SECTION", "TEAM"].includes(v);
}

/** Ids of a node's whole subtree, including itself (depth-first, parents first). */
async function subtreeIds(rootId: string): Promise<string[]> {
  const nodes = await prisma.orgNode.findMany({ select: { id: true, parentId: true } });
  const childrenOf = new Map<string, string[]>();
  for (const n of nodes) {
    if (!n.parentId) continue;
    const arr = childrenOf.get(n.parentId) ?? [];
    arr.push(n.id);
    childrenOf.set(n.parentId, arr);
  }
  const out: string[] = [];
  const walk = (id: string) => {
    out.push(id);
    for (const c of childrenOf.get(id) ?? []) walk(c);
  };
  walk(rootId);
  return out;
}

export async function addOrgNode(formData: FormData) {
  await requireAdmin();
  const name = str(formData.get("name"));
  const kindRaw = str(formData.get("kind"));
  const parentId = str(formData.get("parentId")) || null;
  if (!name) throw new Error("חובה להזין שם מסגרת.");
  if (!isKind(kindRaw)) throw new Error("סוג מסגרת לא תקין.");
  const kind = kindRaw;

  if (kind === "CENTER") {
    await prisma.orgNode.create({ data: { name, kind, parentId: null } });
  } else {
    if (!parentId) throw new Error("יש לבחור מסגרת אב.");
    const parent = await prisma.orgNode.findUnique({ where: { id: parentId } });
    const expected = PARENT_KIND[kind];
    if (!parent || parent.kind !== expected) {
      throw new Error(`מסגרת אב של ${KIND_LABEL[kind]} חייבת להיות ${KIND_LABEL[expected]}.`);
    }
    await prisma.orgNode.create({ data: { name, kind, parentId } });
  }
  revalidatePath("/hierarchy");
  revalidatePath("/", "layout");
}

/** Result of an edit attempt: a rejection reason is shown next to the row, not thrown. */
export type OrgEditState = { error?: string; savedAt?: number };

/**
 * Edit an existing framework: name, kind and parent. Validated against the
 * whole tree, not just the row — a change that would break the
 * center▸domain▸section▸team structure is refused with a specific reason,
 * returned to the form instead of crashing the page.
 */
export async function updateOrgNode(_prev: OrgEditState, formData: FormData): Promise<OrgEditState> {
  await requireAdmin();
  const id = str(formData.get("id"));
  const name = str(formData.get("name"));
  const kindRaw = str(formData.get("kind"));
  const parentId = str(formData.get("parentId")) || null;
  if (!name) return { error: "חובה להזין שם מסגרת." };
  if (!isKind(kindRaw)) return { error: "סוג מסגרת לא תקין." };
  const kind = kindRaw;

  const node = await prisma.orgNode.findUnique({
    where: { id },
    include: { children: { select: { id: true, kind: true } }, _count: { select: { people: true } } },
  });
  if (!node) return { error: "מסגרת לא נמצאה." };

  // parent rules
  if (kind === "CENTER") {
    if (parentId) return { error: "מרכז הוא מסגרת שורש — בחר ״ללא״ כמסגרת אב." };
  } else {
    if (!parentId) return { error: `יש לבחור מסגרת אב מסוג ${KIND_LABEL[PARENT_KIND[kind]]}.` };
    if (parentId === id) return { error: "מסגרת אינה יכולה להיות אב של עצמה." };
    const descendants = new Set(await subtreeIds(id));
    if (descendants.has(parentId)) {
      return { error: "לא ניתן להעביר מסגרת אל תוך מסגרת שנמצאת תחתיה." };
    }
    const parent = await prisma.orgNode.findUnique({ where: { id: parentId } });
    const expected = PARENT_KIND[kind];
    if (!parent || parent.kind !== expected) {
      return { error: `מסגרת אב של ${KIND_LABEL[kind]} חייבת להיות ${KIND_LABEL[expected]}.` };
    }
  }

  // kind rules — children and attached people must stay valid
  if (kind !== node.kind) {
    const allowedChild = CHILD_KIND[kind];
    const badChild = node.children.find((c) => c.kind !== allowedChild);
    if (badChild) {
      return {
        error:
          `לא ניתן לשנות ל${KIND_LABEL[kind]}: תחת המסגרת יש ${KIND_LABEL[badChild.kind]} — ` +
          (allowedChild
            ? `תחת ${KIND_LABEL[kind]} יכולים להיות רק ${KIND_LABEL[allowedChild]}.`
            : `${KIND_LABEL[kind]} אינו יכול להכיל תת-מסגרות.`),
      };
    }
    if (kind !== "TEAM" && node._count.people > 0) {
      return {
        error: `לא ניתן לשנות ל${KIND_LABEL[kind]}: משויכים למסגרת ${node._count.people} אנשים, ואנשים משויכים לצוות בלבד.`,
      };
    }
  }

  await prisma.orgNode.update({ where: { id }, data: { name, kind, parentId } });
  revalidatePath("/hierarchy");
  revalidatePath("/", "layout");
  return { savedAt: Date.now() };
}

/**
 * Delete a framework and its whole subtree. The UI confirms first with the real
 * counts; people attached to deleted teams become unassigned (teamId → null via
 * the FK's ON DELETE SET NULL), and grants on those nodes cascade away.
 */
export async function removeOrgNode(formData: FormData) {
  await requireAdmin();
  const id = str(formData.get("id"));
  const node = await prisma.orgNode.findUnique({ where: { id } });
  if (!node) throw new Error("מסגרת לא נמצאה.");

  const ids = await subtreeIds(id);
  // delete deepest-first so no parent disappears before its children
  await prisma.$transaction(ids.reverse().map((nodeId) => prisma.orgNode.delete({ where: { id: nodeId } })));

  revalidatePath("/hierarchy");
  revalidatePath("/people");
  revalidatePath("/", "layout");
}
