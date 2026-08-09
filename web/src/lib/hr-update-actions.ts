"use server";

import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { computeVisibility } from "@/lib/access";
import { logActivity } from "@/lib/activity-log";
import { UPLOADS_ROOT } from "@/lib/storage";
import {
  parseTable,
  recognizeHeaders,
  proposeMappingWithAgent,
  proposeDateFormatsWithAgent,
  failingDateColumns,
  type DateOrder,
} from "@/lib/hr-import";
import {
  headersSignature,
  structureDiff,
  changedCells,
  buildUpdatePlan,
  type UpdateMapping,
  type UpdateTarget,
  type UpdatePlan,
} from "@/lib/hr-update";

/**
 * The weekly update run lives in one AgentRun row, kind HR_UPDATE — the same
 * pattern as the import: the review approves EXACTLY what was built, and the
 * snapshot advances only on conclusion, so an abandoned run never becomes next
 * week's diff base.
 */
export type UpdateRunState = {
  stage: "structure-gate" | "mapping" | "review";
  filename: string;
  /** where the original bytes wait, relative to uploads */
  filePath: string;
  headers: string[];
  rows: string[][];
  mapping: UpdateMapping;
  dateFormats: Record<string, DateOrder>;
  agentMapped: string[];
  structure?: { appeared: string[]; vanished: string[] };
  plan?: UpdatePlan;
  /** proposal ids created for this run — what the review screen lists */
  proposalIds?: string[];
};

async function requireHr() {
  const session = await getSessionUser();
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, name: true, role: true, grants: { select: { nodeId: true, level: true } } },
  });
  if (!user || (user.role !== "HR" && user.role !== "ADMIN")) {
    throw new Error("עמוד המשא״ן פתוח לתפקיד משא״ן ולאדמין בלבד.");
  }
  if (user.role === "HR" && user.grants.length === 0) {
    throw new Error("עמוד המשא״ן נפתח רק לאחר שהוקצתה לך מסגרת.");
  }
  return user;
}

async function currentRun(userId: string): Promise<{ id: string; state: UpdateRunState } | null> {
  const run = await prisma.agentRun.findFirst({ where: { userId, kind: "HR_UPDATE" }, orderBy: { createdAt: "desc" } });
  if (!run?.output) return null;
  try {
    return { id: run.id, state: JSON.parse(run.output) as UpdateRunState };
  } catch {
    return null;
  }
}

async function saveRun(userId: string, existing: string | null, state: UpdateRunState) {
  if (existing) {
    await prisma.agentRun.update({ where: { id: existing }, data: { output: JSON.stringify(state) } });
  } else {
    await prisma.agentRun.create({
      data: { userId, kind: "HR_UPDATE", prompt: state.filename, status: "SUCCEEDED", output: JSON.stringify(state) },
    });
  }
}

export async function getUpdateRun(userId: string) {
  return currentRun(userId);
}

/**
 * Upload: parse → signature → three roads.
 *  known signature           → straight to the plan (the saved mapping applies)
 *  first file ever           → the mapping stage
 *  changed structure         → the gate: show what appeared/vanished, ASK
 */
export async function uploadUpdateFile(formData: FormData) {
  const me = await requireHr();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("בחר קובץ CSV או Excel.");
  if (file.size > 10 * 1024 * 1024) throw new Error("הקובץ גדול מ-10MB.");

  const buffer = Buffer.from(await file.arrayBuffer());
  const table = parseTable(buffer, file.name);
  const sig = headersSignature(table.headers);
  // the original bytes go to disk NOW — the state cannot carry a binary — and
  // are adopted into history at conclusion or deleted at dismissal
  const rel = path.join("hr-imports", `${Date.now()}-${file.name.replace(/[^\w.א-ת-]/g, "_")}`);
  const abs = path.join(UPLOADS_ROOT, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, buffer);
  const saved = await prisma.importMapping.findUnique({ where: { headersHash: sig } });
  const lastSnapshot = await prisma.importSnapshot.findFirst({ orderBy: { uploadedAt: "desc" } });

  await prisma.agentRun.deleteMany({ where: { userId: me.id, kind: "HR_UPDATE" } });

  if (saved) {
    const state = await buildReviewState(me, file.name, table.headers, table.rows,
      saved.mapping as UpdateMapping, (saved.dateFormats as Record<string, DateOrder>) ?? {});
    state.filePath = rel;
    await saveRun(me.id, null, state);
  } else if (lastSnapshot) {
    // a structure the system does not know, while a previous one exists —
    // the gate: nothing proceeds without explicit consent
    const prevHeaders = ((await prisma.importSnapshot.findFirst({ orderBy: { uploadedAt: "desc" } }))?.rows as string[][])?.[0] ?? [];
    const state: UpdateRunState = {
      stage: "structure-gate", filename: file.name, filePath: rel, headers: table.headers, rows: table.rows,
      mapping: [], dateFormats: {}, agentMapped: [],
      structure: structureDiff(prevHeaders, table.headers),
    };
    await saveRun(me.id, null, state);
  } else {
    const state = await buildMappingState(file.name, table.headers, table.rows);
    state.filePath = rel;
    await saveRun(me.id, null, state);
  }
  revalidatePath("/hr");
}

/** The mapping stage: deterministic recognition + the agent on the foreign, multi-target editable. */
async function buildMappingState(filename: string, headers: string[], rows: string[][]): Promise<UpdateRunState> {
  const { mapping, unrecognized } = await recognizeHeaders(headers);
  const agentMapped: string[] = [];
  if (unrecognized.length > 0) {
    const proposed = await proposeMappingWithAgent(unrecognized, headers, rows);
    for (const m of mapping) {
      const p = proposed.get(m.header);
      if (p && m.target === "ignore") {
        m.target = p;
        agentMapped.push(m.header);
      }
    }
  }
  const failing = failingDateColumns(mapping, rows);
  const dateFormats = Object.fromEntries(await proposeDateFormatsWithAgent(failing));
  return {
    stage: "mapping", filename, filePath: "", headers, rows,
    mapping: mapping.map((m) => ({ header: m.header, targets: m.target === "ignore" ? [] : [m.target as UpdateTarget] })),
    dateFormats, agentMapped,
  };
}

/** Consent at the structure gate: keep the known, map only the new. */
export async function acceptStructureChange() {
  const me = await requireHr();
  const run = await currentRun(me.id);
  if (!run || run.state.stage !== "structure-gate") throw new Error("אין שינוי מבנה ממתין.");

  // seed from any saved mapping rows whose headers still exist
  const savedAll = await prisma.importMapping.findMany();
  const known = new Map<string, UpdateTarget[]>();
  for (const m of savedAll) {
    for (const col of m.mapping as UpdateMapping) known.set(col.header.trim(), col.targets);
  }
  const fresh = await buildMappingState(run.state.filename, run.state.headers, run.state.rows);
  fresh.filePath = run.state.filePath;
  fresh.mapping = fresh.mapping.map((col) =>
    known.has(col.header.trim()) ? { header: col.header, targets: known.get(col.header.trim())! } : col,
  );
  await saveRun(me.id, run.id, fresh);
  revalidatePath("/hr");
}

/** The mapping form submits; save globally and proceed to the plan. */
export async function approveUpdateMapping(formData: FormData) {
  const me = await requireHr();
  const run = await currentRun(me.id);
  if (!run || run.state.stage !== "mapping") throw new Error("אין מיפוי ממתין לאישור.");

  const mapping: UpdateMapping = run.state.headers.map((h, i) => ({
    header: h,
    targets: formData.getAll(`col_${i}`).map((v) => String(v)).filter((v) => v && v !== "ignore") as UpdateTarget[],
  }));
  const sig = headersSignature(run.state.headers);
  await prisma.importMapping.upsert({
    where: { headersHash: sig },
    create: { headersHash: sig, mapping, dateFormats: run.state.dateFormats },
    update: { mapping, dateFormats: run.state.dateFormats },
  });

  const state = await buildReviewState(me, run.state.filename, run.state.headers, run.state.rows, mapping, run.state.dateFormats);
  state.filePath = run.state.filePath;
  await saveRun(me.id, run.id, state);
  revalidatePath("/hr");
}

/** Build the plan and write its PROPOSAL rows — drafts awaiting a hand, their nature. */
async function buildReviewState(
  me: { id: string; name: string; role: import("@/generated/prisma/client").Role; grants: { nodeId: string; level: import("@/generated/prisma/client").AccessLevel }[] },
  filename: string,
  headers: string[],
  rows: string[][],
  mapping: UpdateMapping,
  dateFormats: Record<string, DateOrder>,
): Promise<UpdateRunState> {
  const previous = await prisma.importSnapshot.findFirst({ orderBy: { uploadedAt: "desc" } });
  const prevRows = previous ? (previous.rows as string[][]) : null;
  const prevParsed = prevRows && prevRows.length > 1 ? { headers: prevRows[0], rows: prevRows.slice(1) } : null;

  // the identity column: the first mapped to an identity field
  const defs = await prisma.personFieldDef.findMany({ where: { label: { in: ["תעודת זהות", "מספר אישי"] } } });
  const idTargets = new Set(defs.map((d) => `custom:${d.id}`));
  const idIdx = mapping.findIndex((m) => m.targets.some((t) => idTargets.has(t)));
  if (idIdx === -1) throw new Error("המיפוי חייב עמודת זהות — תעודת זהות או מספר אישי — כדי להתאים אנשים.");

  const changed = changedCells(headers, rows, idIdx, prevParsed);
  const visibility = await computeVisibility({ id: me.id, name: me.name, role: me.role, grants: me.grants });
  const plan = await buildUpdatePlan(visibility, mapping, headers, rows, changed, dateFormats);

  // proposals: replace any open ones from a previous run of this flow
  const proposalIds: string[] = [];
  for (const p of plan.people) {
    if (p.items.length === 0) continue;
    await prisma.extractionProposal.deleteMany({ where: { personId: p.personId, createdBy: `hr-update:${me.id}` } });
    const created = await prisma.extractionProposal.create({
      data: { personId: p.personId, createdBy: `hr-update:${me.id}`, items: p.items },
    });
    proposalIds.push(created.id);
  }

  return { stage: "review", filename, filePath: "", headers, rows, mapping, dateFormats, agentMapped: [], plan, proposalIds };
}

/**
 * Conclusion: the file into the uploads history, the snapshot becomes the next
 * diff base, open proposals of this run are cleared. Only HERE does the
 * baseline advance.
 */
export async function concludeUpdateRun() {
  const me = await requireHr();
  const run = await currentRun(me.id);
  if (!run || run.state.stage !== "review") throw new Error("אין סקירה פעילה.");

  // the original bytes were written at upload; conclusion ADOPTS them into history
  await prisma.importSnapshot.create({
    data: {
      filename: run.state.filename,
      filePath: run.state.filePath,
      headersHash: headersSignature(run.state.headers),
      rows: [run.state.headers, ...run.state.rows],
      uploadedById: me.id,
      uploadedByName: me.name,
    },
  });
  await prisma.extractionProposal.deleteMany({ where: { createdBy: `hr-update:${me.id}` } });
  await prisma.agentRun.deleteMany({ where: { userId: me.id, kind: "HR_UPDATE" } });
  await logActivity({
    action: "hr.update",
    description: `${me.name} סיים סקירת עדכון חיצוני (${run.state.filename})`,
    subjectType: "person",
  });
  revalidatePath("/hr");
  revalidatePath("/people");
}

/** Abandon without advancing the baseline; the waiting original is removed. */
export async function dismissUpdateRun() {
  const me = await requireHr();
  const run = await currentRun(me.id);
  if (run?.state.filePath) {
    const { rm } = await import("fs/promises");
    await rm(path.join(UPLOADS_ROOT, run.state.filePath), { force: true }).catch(() => {});
  }
  await prisma.extractionProposal.deleteMany({ where: { createdBy: `hr-update:${me.id}` } });
  await prisma.agentRun.deleteMany({ where: { userId: me.id, kind: "HR_UPDATE" } });
  revalidatePath("/hr");
}
