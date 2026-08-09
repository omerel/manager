"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { computeVisibility } from "@/lib/access";
import { composeFullName } from "@/lib/person-name";
import { parseIsraeliDate } from "@/lib/dates";
import { logActivity } from "@/lib/activity-log";
import { findByIdentity } from "@/lib/identity-keys";
import { emitMovement } from "@/lib/movements";
import {
  parseTable,
  recognizeHeaders,
  proposeMappingWithAgent,
  proposeDateFormatsWithAgent,
  failingDateColumns,
  classifyRows,
  type ColumnMapping,
  type ColumnTarget,
  type DateOrder,
  type ImportPlan,
} from "@/lib/hr-import";

/**
 * The import's lifecycle lives in one AgentRun row, kind HR_IMPORT:
 *
 *   RUNNING   — executing, output carries {done, total} for the counter
 *   SUCCEEDED — preview stage (approved=false) or final report (approved=true)
 *
 * The row's output JSON carries the parsed rows, the mapping and the plan, so
 * the approval executes EXACTLY what was previewed — not a re-run that might
 * classify differently.
 */
export type ImportState = {
  stage: "preview" | "executing" | "done";
  filename: string;
  headers: string[];
  rows: string[][];
  mapping: ColumnMapping;
  agentMapped: string[]; // headers the agent proposed — marked in the UI
  /** agent-interpreted date order per column header — structure, not values */
  dateFormats: Record<string, DateOrder>;
  plan: ImportPlan;
  progress?: { done: number; total: number };
  report?: { created: number; skipped: number; errors: number; downgraded: string[] };
};

async function requireHr() {
  const session = await getSessionUser();
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, name: true, role: true, grants: { select: { nodeId: true, level: true } } },
  });
  // HR by role; the Admin by their standing authority over everything. A
  // Manager — whatever they hold — is not in the people-import business.
  if (!user || (user.role !== "HR" && user.role !== "ADMIN")) {
    throw new Error("עמוד המשא״ן פתוח לתפקיד משא״ן ולאדמין בלבד.");
  }
  if (user.role === "HR" && user.grants.length === 0) {
    throw new Error("עמוד המשא״ן נפתח רק לאחר שהוקצתה לך מסגרת.");
  }
  return user;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function uploadImport(formData: FormData) {
  const me = await requireHr();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("בחר קובץ CSV או Excel.");
  if (file.size > MAX_FILE_BYTES) throw new Error("הקובץ גדול מ-10MB.");

  const table = parseTable(Buffer.from(await file.arrayBuffer()), file.name);
  const { mapping, unrecognized } = await recognizeHeaders(table.headers);

  // foreign headers get an interpretation, not an error — structure only
  let agentMapped: string[] = [];
  if (unrecognized.length > 0) {
    const proposed = await proposeMappingWithAgent(unrecognized, table.headers, table.rows);
    for (const m of mapping) {
      const p = proposed.get(m.header);
      if (p && m.target === "ignore") {
        m.target = p;
        agentMapped.push(m.header);
      }
    }
  }

  // date columns the standard gate cannot read → the agent interprets their
  // ORDER once; values are then re-parsed deterministically under it, and a
  // value no order explains keeps its honest row error
  const failing = failingDateColumns(mapping, table.rows);
  const dateFormats = Object.fromEntries(await proposeDateFormatsWithAgent(failing));

  const visibility = await computeVisibility({ id: me.id, name: me.name, role: me.role, grants: me.grants });
  const plan = await classifyRows(visibility, mapping, table.rows, dateFormats);

  const state: ImportState = {
    stage: "preview",
    filename: file.name,
    headers: table.headers,
    rows: table.rows,
    mapping,
    agentMapped,
    dateFormats,
    plan,
  };
  // one live import per user: a new upload replaces an unapproved preview
  await prisma.agentRun.deleteMany({ where: { userId: me.id, kind: "HR_IMPORT", status: "SUCCEEDED" } });
  await prisma.agentRun.create({
    data: { userId: me.id, kind: "HR_IMPORT", prompt: file.name, status: "SUCCEEDED", output: JSON.stringify(state) },
  });
  revalidatePath("/hr");
}

/** A hand correction to the mapping reclassifies the SAME rows under it. */
export async function remapImport(formData: FormData) {
  const me = await requireHr();
  const run = await currentImport(me.id);
  if (!run || run.state.stage !== "preview") throw new Error("אין ייבוא בשלב תצוגה מקדימה.");

  const mapping: ColumnMapping = run.state.headers.map((h, i) => ({
    header: h,
    target: (String(formData.get(`col_${i}`) ?? "ignore") || "ignore") as ColumnTarget,
  }));
  // a remap can point new columns at dates — give their formats the same chance
  const failing = failingDateColumns(mapping, run.state.rows);
  const known = run.state.dateFormats ?? {};
  const unknown = failing.filter((f) => !known[f.header]);
  const dateFormats = { ...known, ...Object.fromEntries(await proposeDateFormatsWithAgent(unknown)) };
  const visibility = await computeVisibility({ id: me.id, name: me.name, role: me.role, grants: me.grants });
  const plan = await classifyRows(visibility, mapping, run.state.rows, dateFormats);
  const state: ImportState = { ...run.state, mapping, agentMapped: [], dateFormats, plan };
  await prisma.agentRun.update({ where: { id: run.id }, data: { output: JSON.stringify(state) } });
  revalidatePath("/hr");
}

export async function approveImport() {
  const me = await requireHr();
  const run = await currentImport(me.id);
  if (!run || run.state.stage !== "preview") throw new Error("אין ייבוא ממתין לאישור.");

  const creates = run.state.plan.rows.filter((r) => r.kind === "create");
  const state: ImportState = {
    ...run.state,
    stage: "executing",
    progress: { done: 0, total: creates.length },
  };
  await prisma.agentRun.update({ where: { id: run.id }, data: { status: "RUNNING", output: JSON.stringify(state) } });

  const actorName = me.name;
  after(async () => {
    let created = 0;
    const downgraded: string[] = [];
    for (let i = 0; i < creates.length; i++) {
      const c = creates[i];
      if (c.kind !== "create") continue;
      try {
        // re-verify against the LIVE registry: a person matched since the
        // preview is skipped and reported, never duplicated by a stale screen
        const defs = await prisma.personFieldDef.findMany({ where: { label: { in: ["תעודת זהות", "מספר אישי"] } }, select: { id: true, label: true } });
        const tzDef = defs.find((d) => d.label === "תעודת זהות")?.id;
        const paDef = defs.find((d) => d.label === "מספר אישי")?.id;
        const tz = c.data.custom.find((x) => x.fieldDefId === tzDef)?.value;
        const pa = c.data.custom.find((x) => x.fieldDefId === paDef)?.value;
        const hits = await findByIdentity({ tz, personalNumber: pa });
        if (hits.length > 0) {
          downgraded.push(`${c.name} — נוצר בינתיים על ידי אחר (${hits[0].label})`);
        } else {
          const allDefs = await prisma.personFieldDef.findMany({ select: { id: true, order: true } });
          const orderOf = new Map(allDefs.map((d) => [d.id, d.order]));
          const createdPerson = await prisma.person.create({
            data: {
              firstName: c.data.firstName,
              lastName: c.data.lastName,
              fullName: composeFullName(c.data.firstName, c.data.lastName),
              birthDate: parseIsraeliDate(c.data.birthDate)!,
              recruitmentDate: parseIsraeliDate(c.data.recruitmentDate)!,
              placementDate: parseIsraeliDate(c.data.placementDate)!,
              teamId: c.teamId, // null = ללא מסגרת, as previewed and warned
              fieldValues: {
                create: c.data.custom.map((x) => ({ fieldDefId: x.fieldDefId, value: x.value, order: orderOf.get(x.fieldDefId) ?? 0 })),
              },
            },
          });
          created++;
          // per-person, not only the aggregate summary — the movement log's
          // whole point. The actor rides in explicitly: this runs in after(),
          // where there is no session to read.
          await emitMovement({
            kind: "CREATED", personId: createdPerson.id, personName: createdPerson.fullName,
            toTeamId: c.teamId, source: "import", actor: { id: me.id, name: actorName },
          });
        }
      } catch (e) {
        downgraded.push(`${c.name} — ${(e as Error).message.slice(0, 120)}`);
      }
      // the counter the page polls
      const progressState: ImportState = { ...state, progress: { done: i + 1, total: creates.length } };
      await prisma.agentRun.update({ where: { id: run.id }, data: { output: JSON.stringify(progressState) } }).catch(() => {});
    }

    const final: ImportState = {
      ...state,
      stage: "done",
      progress: { done: creates.length, total: creates.length },
      report: {
        created,
        skipped: run.state.plan.counts.skip,
        errors: run.state.plan.counts.error + run.state.plan.counts.halt,
        downgraded,
      },
    };
    await prisma.agentRun.update({ where: { id: run.id }, data: { status: "SUCCEEDED", output: JSON.stringify(final) } });
    await logActivity({
      action: "hr.import",
      description: `${actorName} ייבא טבלת אנשים (${run.state.filename}): ${created} נוצרו, ${downgraded.length} דולגו בביצוע`,
      subjectType: "person",
    });
    revalidatePath("/hr");
    revalidatePath("/people");
  });
  revalidatePath("/hr");
}

export async function dismissImport() {
  const me = await requireHr();
  await prisma.agentRun.deleteMany({ where: { userId: me.id, kind: "HR_IMPORT" } });
  revalidatePath("/hr");
}

/** The user's current import row, parsed. */
export async function currentImport(userId: string): Promise<{ id: string; state: ImportState } | null> {
  const run = await prisma.agentRun.findFirst({
    where: { userId, kind: "HR_IMPORT" },
    orderBy: { createdAt: "desc" },
  });
  if (!run?.output) return null;
  try {
    return { id: run.id, state: JSON.parse(run.output) as ImportState };
  } catch {
    return null;
  }
}
