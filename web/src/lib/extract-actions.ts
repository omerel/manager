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
import { stageUpload, materializeDocument, extractionFields } from "@/lib/doc-extract";
import { runExtraction } from "@/lib/agent";
import { saveUpload, deleteUpload } from "@/lib/storage";
import { runInBackground, hasLiveRun } from "@/lib/jobs";
import { composeFullName } from "@/lib/person-name";
import { parseIsraeliDate } from "@/lib/dates";
import { proposeFieldUpdates } from "@/lib/proposals";
export type { ProposalItem } from "@/lib/proposals";
import type { ProposalItem } from "@/lib/proposals";

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

/* ---------- Profile photo ---------- */

export async function setProfilePhoto(formData: FormData) {
  const personId = str(formData.get("personId"));
  await requireEditForPerson(personId);
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) throw new Error("לא נבחרה תמונה.");
  if (!file.type.startsWith("image/")) throw new Error("יש להעלות קובץ תמונה.");

  const previous = await prisma.person.findUnique({ where: { id: personId }, select: { photoPath: true } });
  const { storagePath } = await saveUpload(personId, file);
  await prisma.person.update({ where: { id: personId }, data: { photoPath: storagePath } });
  await deleteUpload(previous?.photoPath); // the replaced file is unreferenced from here on

  revalidatePath(`/people/${personId}`);
  revalidatePath("/people"); // the avatar in the list must change too
  redirect(`/people/${personId}?edit=1`);
}

/* ---------- Document extraction (agent proposes, human approves per field) ---------- */

export async function extractFromDocument(formData: FormData) {
  const personId = str(formData.get("personId"));
  const me = await requireEditForPerson(personId);
  const file = formData.get("document");
  if (!(file instanceof File) || file.size === 0) throw new Error("לא נבחר מסמך.");
  // duplicate-run guard: one live extraction per person
  if (await hasLiveRun({ personId, kind: "EXTRACT" })) redirect(`/people/${personId}?edit=1&busy=1`);

  const fields = await extractionFields();
  // staging is instant; extraction (possibly OCR) happens inside the job
  const dir = await mkdtemp(path.join(tmpdir(), "extract-"));
  const staged = await stageUpload(dir, file);

  await runInBackground(
    { userId: me.id, kind: "EXTRACT", personId, prompt: `חילוץ ממסמך: ${file.name}` },
    async (id) => {
      try {
        const doc = await materializeDocument(dir, staged);
        if (!doc) throw new Error("לא ניתן לחלץ טקסט מהמסמך (גם לא באמצעות OCR).");
        const raw = await runExtraction(dir, doc.name, fields);
        const items = await proposeFieldUpdates(me.id, personId, raw, fields);
        await prisma.agentRun.update({ where: { id }, data: { status: "SUCCEEDED", output: String(items.length) } });
      } catch (e) {
        await prisma.agentRun.update({
          where: { id },
          data: { status: "FAILED", error: e instanceof Error ? e.message.slice(0, 2000) : String(e) },
        });
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );
  revalidatePath(`/people/${personId}`);
  // the person-card panel wants to land back on the card; the HR central
  // review resolves DOZENS in sequence and must stay put — it passes stay=1
  if (str(formData.get("stay")) !== "1") redirect(`/people/${personId}?edit=1`);
}

async function applyItem(personId: string, item: ProposalItem & { kind?: "delete" }) {
  // ---- career values from the external update: resolved by LABEL against the
  // person's OWN plan copy; deletion removes exactly the one row
  if (item.key.startsWith("point:")) {
    const label = item.key.slice(6);
    const person = await prisma.person.findUniqueOrThrow({
      where: { id: personId },
      select: { assignedPlan: { select: { pointEvents: { where: { label }, select: { id: true } } } } },
    });
    const event = person.assignedPlan?.pointEvents[0];
    if (!event) throw new Error(`אירוע ״${label}״ אינו בתכנית של אדם זה.`);
    if (item.kind === "delete" || !item.proposed) {
      await prisma.pointProgress.deleteMany({ where: { personId, pointEventId: event.id } });
      return;
    }
    const d = parseIsraeliDate(item.proposed);
    if (!d) throw new Error("תאריך ביצוע לא תקין — נדרש dd/mm/yyyy.");
    await prisma.pointProgress.upsert({
      where: { personId_pointEventId: { personId, pointEventId: event.id } },
      create: { personId, pointEventId: event.id, doneOn: d, note: "עדכון חיצוני (משא״ן)" },
      update: { doneOn: d },
    });
    return;
  }
  if (item.key.startsWith("metric:")) {
    const name = item.key.slice(7);
    const person = await prisma.person.findUniqueOrThrow({
      where: { id: personId },
      select: { assignedPlan: { select: { cumulativeMetrics: { where: { name }, select: { id: true } } } } },
    });
    const metric = person.assignedPlan?.cumulativeMetrics[0];
    if (!metric) throw new Error(`מדד ״${name}״ אינו בתכנית של אדם זה.`);
    if (item.kind === "delete" || !item.proposed) {
      await prisma.metricReading.deleteMany({ where: { personId, metricId: metric.id } });
      return;
    }
    const num = Number(item.proposed);
    if (!Number.isFinite(num)) throw new Error("ערך מדד לא תקין.");
    await prisma.metricReading.upsert({
      where: { personId_metricId: { personId, metricId: metric.id } },
      create: { personId, metricId: metric.id, value: num, asOf: new Date(), note: "עדכון חיצוני (משא״ן)" },
      update: { value: num, asOf: new Date() },
    });
    return;
  }
  // ---- a deletion of a configurable field empties its value
  if (item.kind === "delete" && item.key.startsWith("field:")) {
    await prisma.personFieldValue.deleteMany({ where: { personId, fieldDefId: item.key.slice(6) } });
    return;
  }
  if (item.key === "framework") {
    // the extracted NAME becomes a team only through the shared resolver —
    // in-scope only, namesakes refused — the same rule as the table import
    const { getSessionUser } = await import("@/lib/session");
    const { computeVisibility } = await import("@/lib/access");
    const { resolveTeamByName } = await import("@/lib/hr-import");
    const user = await getSessionUser();
    const visibility = await computeVisibility(user);
    const nodes = await prisma.orgNode.findMany({ select: { id: true, name: true, parentId: true, kind: true } });
    const res = resolveTeamByName(visibility, nodes, item.proposed);
    if (!res.ok) throw new Error(res.reason);
    await prisma.person.update({ where: { id: personId }, data: { teamId: res.teamId } });
  } else if (item.key === "firstName" || item.key === "lastName") {
    const p = await prisma.person.findUniqueOrThrow({ where: { id: personId } });
    const firstName = item.key === "firstName" ? item.proposed : p.firstName;
    const lastName = item.key === "lastName" ? item.proposed : p.lastName;
    await prisma.person.update({
      where: { id: personId },
      data: { firstName, lastName, fullName: composeFullName(firstName, lastName) },
    });
  } else if (item.key === "birthDate" || item.key === "recruitmentDate" || item.key === "placementDate" || item.key === "endOfServiceDate") {
    // read day-first; a value we cannot parse is refused, never guessed
    const d = parseIsraeliDate(item.proposed);
    if (!d) throw new Error("תאריך מוצע לא תקין — נדרש dd/mm/yyyy.");
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
  // the person-card panel wants to land back on the card; the HR central
  // review resolves DOZENS in sequence and must stay put — it passes stay=1
  if (str(formData.get("stay")) !== "1") redirect(`/people/${personId}?edit=1`);
}

/* ---------- Create-from-document (new person): agent pre-fills a draft form ---------- */

export async function extractForNewPerson(formData: FormData) {
  const me = await getSessionUser();
  const visibility = await computeVisibility(me);
  const canCreateSomewhere = visibility.isAdmin || [...visibility.nodeIds].some((id) => visibility.canEdit(id));
  if (!canCreateSomewhere) throw new Error("אין לך הרשאת עריכה לאף מסגרת.");

  const file = formData.get("document");
  if (!(file instanceof File) || file.size === 0) throw new Error("לא נבחר מסמך.");
  // duplicate-run guard: one live new-person extraction per user
  if (await hasLiveRun({ userId: me.id, kind: "EXTRACT", personId: null })) redirect("/people/new?busy=1");

  const fields = await extractionFields();
  const dir = await mkdtemp(path.join(tmpdir(), "extract-new-"));
  const staged = await stageUpload(dir, file);

  await runInBackground(
    { userId: me.id, kind: "EXTRACT", prompt: `יצירה ממסמך: ${file.name}` },
    async (id) => {
      try {
        const doc = await materializeDocument(dir, staged);
        if (!doc) throw new Error("לא ניתן לחלץ טקסט מהמסמך (גם לא באמצעות OCR).");
        const raw = await runExtraction(dir, doc.name, fields);
        if (raw.length === 0) {
          await prisma.agentRun.update({ where: { id }, data: { status: "SUCCEEDED", output: "" } });
          return;
        }
        const values = Object.fromEntries(raw.map((r) => [r.key, r.proposed]));
        const draft = await prisma.personDraft.create({ data: { createdBy: me.id, values } });
        // the new-person page picks the draft id up from the job record
        await prisma.agentRun.update({ where: { id }, data: { status: "SUCCEEDED", output: draft.id } });
      } catch (e) {
        await prisma.agentRun.update({
          where: { id },
          data: { status: "FAILED", error: e instanceof Error ? e.message.slice(0, 2000) : String(e) },
        });
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );
  redirect("/people/new?extracting=1");
}

export async function discardProposal(formData: FormData) {
  const personId = str(formData.get("personId"));
  await requireEditForPerson(personId);
  await prisma.extractionProposal.deleteMany({ where: { personId } });
  revalidatePath(`/people/${personId}`);
  // the person-card panel wants to land back on the card; the HR central
  // review resolves DOZENS in sequence and must stay put — it passes stay=1
  if (str(formData.get("stay")) !== "1") redirect(`/people/${personId}?edit=1`);
}
