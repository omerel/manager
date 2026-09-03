"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { logActivity } from "@/lib/activity-log";
import { emitMovement, pathOf } from "@/lib/movements";
import type { OrgKind } from "@/generated/prisma/client";

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

// The nesting rule lives in `org-nesting` so the importer enforces the SAME one
// this form does; two copies would be two truths to keep in step.
import { PARENT_KIND, CHILD_KIND, KIND_LABEL } from "@/lib/org-nesting";
import { parseTable } from "@/lib/hr-import";
import {
  recognizeOrgHeaders,
  validateOrgRows,
  type OrgFault,
  type OrgMapping,
  type OrgPlanNode,
} from "@/lib/org-import";

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
    const created = await prisma.orgNode.create({ data: { name, kind, parentId: null } });
    await logActivity({ action: "org.create", description: `יצר ${KIND_LABEL[kind]} ${name}`, subjectType: "org", subjectId: created.id });
  } else {
    if (!parentId) throw new Error("יש לבחור מסגרת אב.");
    const parent = await prisma.orgNode.findUnique({ where: { id: parentId } });
    const expected = PARENT_KIND[kind];
    if (!parent || parent.kind !== expected) {
      throw new Error(`מסגרת אב של ${KIND_LABEL[kind]} חייבת להיות ${KIND_LABEL[expected]}.`);
    }
    const created = await prisma.orgNode.create({ data: { name, kind, parentId } });
    await logActivity({ action: "org.create", description: `יצר ${KIND_LABEL[kind]} ${name}`, subjectType: "org", subjectId: created.id });
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
  await logActivity({ action: "org.update", description: `ערך את ${KIND_LABEL[kind]} ${name}`, subjectType: "org", subjectId: id });
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
  // the people about to be orphaned, captured BEFORE the delete nulls their
  // teamId at the database level — the one movement that had no witnesses
  const orphans = await prisma.person.findMany({
    where: { teamId: { in: ids } },
    select: { id: true, fullName: true, teamId: true },
  });
  // paths BEFORE the delete — afterwards there is nothing left to snapshot
  const orphanPaths = new Map<string, string | null>();
  for (const teamId of new Set(orphans.map((o) => o.teamId!))) orphanPaths.set(teamId, await pathOf(teamId));
  // delete deepest-first so no parent disappears before its children
  await prisma.$transaction(ids.reverse().map((nodeId) => prisma.orgNode.delete({ where: { id: nodeId } })));
  await logActivity({
    action: "org.delete",
    description: `מחק את ${KIND_LABEL[node.kind]} ${node.name}${ids.length > 1 ? ` ו-${ids.length - 1} מסגרות תחתיה` : ""}`,
    subjectType: "org",
    subjectId: id,
  });
  // the orphaning gains witnesses: one movement per person the delete unassigned
  for (const o of orphans) {
    await emitMovement({
      kind: "MOVED", personId: o.id, personName: o.fullName,
      fromTeamId: o.teamId, fromPath: orphanPaths.get(o.teamId!) ?? null,
      toTeamId: null, toPath: null, source: "org-delete",
    });
  }

  revalidatePath("/hierarchy");
  revalidatePath("/people");
  revalidatePath("/", "layout");
}

/* ---------- Importing the whole tree from a file (Admin) ---------- */

/**
 * What replacing the tree costs, counted from the database rather than
 * described in words.
 *
 * Deleting the nodes cascades their grants and queries away — the schema's own
 * behaviour, not this import's invention. Saying "the old tree will be deleted"
 * while silently taking every manager's visibility with it would be the more
 * dangerous kind of honest, so each number is read and shown.
 */
export type OrgImportCost = {
  frameworks: number;
  grants: number;
  queries: number;
  commanders: number;
  peopleUnassigned: number;
};

export async function orgImportCost(): Promise<OrgImportCost> {
  const [frameworks, grants, queries, commanders, peopleUnassigned] = await Promise.all([
    prisma.orgNode.count(),
    prisma.accessGrant.count(),
    prisma.query.count(),
    prisma.user.count({ where: { commandsNodeId: { not: null } } }),
    prisma.person.count({ where: { teamId: { not: null } } }),
  ]);
  return { frameworks, grants, queries, commanders, peopleUnassigned };
}

export type OrgImportState =
  | { step: "idle" }
  | { step: "map"; headers: string[]; mapping: OrgMapping; rows: string[][]; filename: string }
  | { step: "review"; faults: OrgFault[]; plan: OrgPlanNode[]; cost: OrgImportCost; mapping: OrgMapping; rows: string[][]; filename: string }
  | { step: "done"; created: number }
  | { step: "error"; error: string };

/** Stage one: read the file and PROPOSE a mapping. Nothing is validated yet. */
export async function uploadOrgFile(_prev: OrgImportState, formData: FormData): Promise<OrgImportState> {
  try {
    await requireAdmin();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { step: "error", error: "לא נבחר קובץ." };
    if (file.size > 10 * 1024 * 1024) return { step: "error", error: "הקובץ גדול מ-10MB." };
    const parsed = parseTable(Buffer.from(await file.arrayBuffer()), file.name);
    return {
      step: "map",
      headers: parsed.headers,
      mapping: recognizeOrgHeaders(parsed.headers),
      rows: parsed.rows,
      filename: file.name,
    };
  } catch (e) {
    return { step: "error", error: e instanceof Error ? e.message : "קריאת הקובץ נכשלה." };
  }
}

/** Stage two: validate BY THE APPROVED MAPPING, and price the replacement. */
export async function reviewOrgImport(_prev: OrgImportState, formData: FormData): Promise<OrgImportState> {
  try {
    await requireAdmin();
    const payload = JSON.parse(str(formData.get("payload"))) as { rows: string[][]; headers: string[]; filename: string };
    const mapping: OrgMapping = payload.headers.map((header, i) => ({
      header,
      target: (str(formData.get(`col_${i}`)) || "ignore") as OrgMapping[number]["target"],
    }));
    const { faults, plan } = validateOrgRows({ headers: payload.headers, rows: payload.rows }, mapping);
    return { step: "review", faults, plan, cost: await orgImportCost(), mapping, rows: payload.rows, filename: payload.filename };
  } catch (e) {
    return { step: "error", error: e instanceof Error ? e.message : "הבדיקה נכשלה." };
  }
}

/**
 * Stage three: replace the tree, in ONE transaction.
 *
 * Re-validated here rather than trusted from the review: the plan travels
 * through the browser, and a tree is not something to build from a posted
 * value. Roots are written first so a parent always exists for its children.
 */
export async function applyOrgImport(_prev: OrgImportState, formData: FormData): Promise<OrgImportState> {
  try {
    await requireAdmin();
    const payload = JSON.parse(str(formData.get("payload"))) as { rows: string[][]; headers: string[]; mapping: OrgMapping };
    const { faults, plan } = validateOrgRows({ headers: payload.headers, rows: payload.rows }, payload.mapping);
    if (faults.length) return { step: "error", error: "הקובץ אינו תקין — יש לתקן ולהעלות שוב." };
    if (plan.length === 0) return { step: "error", error: "אין מסגרות לייבוא." };

    await prisma.$transaction(async (tx) => {
      // a half-replaced org is worse than either state, so both halves are here
      await tx.orgNode.deleteMany({});
      const idOf = new Map<string, string>();
      for (const node of plan) {
        const created = await tx.orgNode.create({
          data: { name: node.name, kind: node.kind, parentId: node.parentName ? idOf.get(node.parentName) ?? null : null },
        });
        idOf.set(node.name, created.id);
      }
    });

    await logActivity({
      action: "org.import",
      description: `ייבא עץ מבנה מקובץ: ${plan.length} מסגרות (העץ הקודם הוחלף)`,
      subjectType: "org",
    });
    revalidatePath("/hierarchy");
    revalidatePath("/", "layout");
    return { step: "done", created: plan.length };
  } catch (e) {
    return { step: "error", error: e instanceof Error ? e.message : "הייבוא נכשל." };
  }
}
