"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { prisma } from "@/lib/prisma";
import { requireEditForPerson } from "@/lib/authz";
import { getSessionUser } from "@/lib/session";
import { computeVisibility } from "@/lib/access";
import { materializeDocument } from "@/lib/doc-extract";
import { runExtraction } from "@/lib/agent";
import { saveUpload } from "@/lib/storage";

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

export type ProposalItem = {
  key: string; // "fullName" | "recruitmentDate" | "endOfServiceDate" | "field:<fieldDefId>"
  label: string;
  current: string;
  proposed: string;
};

/* ---------- Profile photo ---------- */

export async function setProfilePhoto(formData: FormData) {
  const personId = str(formData.get("personId"));
  await requireEditForPerson(personId);
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) throw new Error("לא נבחרה תמונה.");
  if (!file.type.startsWith("image/")) throw new Error("יש להעלות קובץ תמונה.");
  const { storagePath } = await saveUpload(personId, file);
  await prisma.person.update({ where: { id: personId }, data: { photoPath: storagePath } });
  revalidatePath(`/people/${personId}`);
  redirect(`/people/${personId}?edit=1`);
}

/* ---------- Document extraction (agent proposes, human approves per field) ---------- */

export async function extractFromDocument(formData: FormData) {
  const personId = str(formData.get("personId"));
  const me = await requireEditForPerson(personId);
  const file = formData.get("document");
  if (!(file instanceof File) || file.size === 0) throw new Error("לא נבחר מסמך.");

  const person = await prisma.person.findUniqueOrThrow({
    where: { id: personId },
    include: { fieldValues: { include: { field: true } } },
  });
  const defs = await prisma.personFieldDef.findMany({ orderBy: { order: "asc" } });

  // schema handed to the agent
  const fields = [
    { key: "fullName", label: "שם מלא", type: "טקסט" },
    { key: "recruitmentDate", label: "תאריך גיוס", type: "תאריך" },
    { key: "endOfServiceDate", label: "תאריך סיום שירות", type: "תאריך" },
    ...defs.map((d) => ({
      key: `field:${d.id}`,
      label: d.label,
      type: d.type === "DATE" ? "תאריך" : d.type === "NUMBER" ? "מספר" : "טקסט",
      options: d.type === "ENUM" ? d.options : undefined,
    })),
  ];

  const dir = await mkdtemp(path.join(tmpdir(), "extract-"));
  let raw: { key: string; proposed: string }[] = [];
  try {
    const docName = await materializeDocument(dir, file);
    raw = await runExtraction(dir, docName, fields);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  // merge with current values; keep only real differences
  const valueByDef = new Map(person.fieldValues.map((fv) => [fv.fieldDefId, fv.value]));
  const currentOf = (key: string): string => {
    if (key === "fullName") return person.fullName;
    if (key === "recruitmentDate") return person.recruitmentDate.toISOString().slice(0, 10);
    if (key === "endOfServiceDate") return person.endOfServiceDate?.toISOString().slice(0, 10) ?? "";
    if (key.startsWith("field:")) return valueByDef.get(key.slice(6)) ?? "";
    return "";
  };
  const labelOf = new Map(fields.map((f) => [f.key, f.label]));
  const items: ProposalItem[] = raw
    .filter((r) => labelOf.has(r.key))
    .map((r) => ({ key: r.key, label: labelOf.get(r.key)!, current: currentOf(r.key), proposed: r.proposed }))
    .filter((it) => it.proposed !== it.current);

  // one open proposal per person — replace any previous one
  await prisma.extractionProposal.deleteMany({ where: { personId } });
  if (items.length > 0) {
    await prisma.extractionProposal.create({ data: { personId, createdBy: me.id, items } });
  }
  revalidatePath(`/people/${personId}`);
  redirect(`/people/${personId}?edit=1${items.length === 0 ? "&extract=none" : ""}`);
}

async function applyItem(personId: string, item: ProposalItem) {
  if (item.key === "fullName") {
    await prisma.person.update({ where: { id: personId }, data: { fullName: item.proposed } });
  } else if (item.key === "recruitmentDate" || item.key === "endOfServiceDate") {
    const d = new Date(item.proposed);
    if (isNaN(d.getTime())) throw new Error("תאריך מוצע לא תקין.");
    await prisma.person.update({ where: { id: personId }, data: { [item.key]: d } });
  } else if (item.key.startsWith("field:")) {
    const fieldDefId = item.key.slice(6);
    const def = await prisma.personFieldDef.findUnique({ where: { id: fieldDefId } });
    if (!def) throw new Error("שדה לא קיים.");
    await prisma.personFieldValue.upsert({
      where: { personId_fieldDefId: { personId, fieldDefId } },
      create: { personId, fieldDefId, value: item.proposed, order: def.order },
      update: { value: item.proposed },
    });
  }
}

/** Approve or reject a single proposed field. decision = "apply" | "reject". */
export async function resolveProposalItem(formData: FormData) {
  const personId = str(formData.get("personId"));
  await requireEditForPerson(personId);
  const proposalId = str(formData.get("proposalId"));
  const key = str(formData.get("key"));
  const decision = str(formData.get("decision"));

  const proposal = await prisma.extractionProposal.findFirst({ where: { id: proposalId, personId } });
  if (!proposal) return;
  const items = (proposal.items as ProposalItem[]) ?? [];
  const item = items.find((i) => i.key === key);
  if (!item) return;

  if (decision === "apply") await applyItem(personId, item);

  const rest = items.filter((i) => i.key !== key);
  if (rest.length === 0) {
    await prisma.extractionProposal.delete({ where: { id: proposal.id } });
  } else {
    await prisma.extractionProposal.update({ where: { id: proposal.id }, data: { items: rest } });
  }
  revalidatePath(`/people/${personId}`);
  redirect(`/people/${personId}?edit=1`);
}

/* ---------- Create-from-document (new person): agent pre-fills a draft form ---------- */

export async function extractForNewPerson(formData: FormData) {
  const me = await getSessionUser();
  const visibility = await computeVisibility(me);
  const canCreateSomewhere = visibility.isAdmin || [...visibility.nodeIds].some((id) => visibility.canEdit(id));
  if (!canCreateSomewhere) throw new Error("אין לך הרשאת עריכה לאף מסגרת.");

  const file = formData.get("document");
  if (!(file instanceof File) || file.size === 0) throw new Error("לא נבחר מסמך.");

  const defs = await prisma.personFieldDef.findMany({ orderBy: { order: "asc" } });
  const fields = [
    { key: "fullName", label: "שם מלא", type: "טקסט" },
    { key: "recruitmentDate", label: "תאריך גיוס", type: "תאריך" },
    { key: "endOfServiceDate", label: "תאריך סיום שירות", type: "תאריך" },
    ...defs.map((d) => ({
      key: `field:${d.id}`,
      label: d.label,
      type: d.type === "DATE" ? "תאריך" : d.type === "NUMBER" ? "מספר" : "טקסט",
      options: d.type === "ENUM" ? d.options : undefined,
    })),
  ];

  const dir = await mkdtemp(path.join(tmpdir(), "extract-new-"));
  let raw: { key: string; proposed: string }[] = [];
  try {
    const docName = await materializeDocument(dir, file);
    raw = await runExtraction(dir, docName, fields);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  if (raw.length === 0) redirect("/people/new?extract=none");

  const values = Object.fromEntries(raw.map((r) => [r.key, r.proposed]));
  const draft = await prisma.personDraft.create({ data: { createdBy: me.id, values } });
  redirect(`/people/new?draft=${draft.id}`);
}

export async function discardProposal(formData: FormData) {
  const personId = str(formData.get("personId"));
  await requireEditForPerson(personId);
  await prisma.extractionProposal.deleteMany({ where: { personId } });
  revalidatePath(`/people/${personId}`);
  redirect(`/people/${personId}?edit=1`);
}
