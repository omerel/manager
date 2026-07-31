import path from "path";
import { readFile, rm, mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import AdmZip from "adm-zip";
import { prisma } from "@/lib/prisma";
import { resolveUpload, UPLOADS_ROOT } from "@/lib/storage";

/**
 * Bundle format v1. The model inventory is EXPLICIT (not reflective): adding a
 * model to the schema later forces a conscious portability decision here.
 * Transient tables (AgentRun, PersonDraft, ExtractionProposal) are never
 * exported — but ARE wiped on restore (they reference replaced rows).
 */
export const BUNDLE_VERSION = 1;
export type BundleScope = "full" | "config";

type Tables = Record<string, unknown[]>;
export type Bundle = { version: number; scope: BundleScope; exportedAt: string; tables: Tables };

/** Topological sort for self-referencing trees (parents before children). */
function byDepth<T extends { id: string }>(rows: T[], parentOf: (r: T) => string | null): T[] {
  const depth = new Map<string, number>();
  const byId = new Map(rows.map((r) => [r.id, r]));
  const d = (r: T): number => {
    if (depth.has(r.id)) return depth.get(r.id)!;
    const p = parentOf(r);
    const val = p && byId.has(p) ? d(byId.get(p)!) + 1 : 0;
    depth.set(r.id, val);
    return val;
  };
  return [...rows].sort((a, b) => d(a) - d(b));
}

/* ---------------- export ---------------- */

export async function dumpTables(scope: BundleScope): Promise<Tables> {
  const orgNodes = byDepth(await prisma.orgNode.findMany(), (n) => n.parentId);
  // templates before copies (copies FK-reference their source template)
  const plans = (await prisma.careerPlan.findMany()).sort((a, b) => Number(b.isTemplate) - Number(a.isTemplate));
  const planIds = new Set(
    (scope === "config" ? plans.filter((p) => p.isTemplate) : plans).map((p) => p.id),
  );
  const inPlans = { where: { planId: { in: [...planIds] } } };

  const tables: Tables = {
    appSetting: await prisma.appSetting.findMany(),
    personFieldDef: await prisma.personFieldDef.findMany(),
    orgNode: orgNodes,
    careerPlan: plans.filter((p) => planIds.has(p.id)),
    pointEvent: await prisma.pointEvent.findMany(inPlans),
    cumulativeMetric: await prisma.cumulativeMetric.findMany(inPlans),
    metricCheckpoint: await prisma.metricCheckpoint.findMany({
      where: { metric: { planId: { in: [...planIds] } } },
    }),
    recurringEvent: await prisma.recurringEvent.findMany(inPlans),
    user: await prisma.user.findMany(),
    accessGrant: await prisma.accessGrant.findMany(),
  };

  if (scope === "full") {
    tables.person = await prisma.person.findMany();
    tables.personFieldValue = await prisma.personFieldValue.findMany();
    tables.pointProgress = await prisma.pointProgress.findMany();
    tables.metricReading = await prisma.metricReading.findMany();
    tables.evalEntry = await prisma.evalEntry.findMany();
    tables.attachment = await prisma.attachment.findMany();
    tables.rule = await prisma.rule.findMany();
    // plan history: ended assignments and the decisions taken when they changed
    tables.planAssignment = await prisma.planAssignment.findMany();
    tables.planWaiver = await prisma.planWaiver.findMany();
    tables.planCarryOver = await prisma.planCarryOver.findMany();
  }
  return tables;
}

/** Relative uploads-paths referenced by a full dump (attachments, photos, logo). */
function referencedFiles(tables: Tables): string[] {
  const rels = new Set<string>();
  for (const a of (tables.attachment ?? []) as { storagePath: string }[]) rels.add(a.storagePath);
  for (const p of (tables.person ?? []) as { photoPath: string | null }[]) if (p.photoPath) rels.add(p.photoPath);
  for (const s of (tables.appSetting ?? []) as { key: string; value: string }[]) {
    if (s.key === "logoPath") rels.add(s.value);
  }
  return [...rels];
}

export async function buildFullZip(): Promise<Buffer> {
  const tables = await dumpTables("full");
  const bundle: Bundle = { version: BUNDLE_VERSION, scope: "full", exportedAt: new Date().toISOString(), tables };
  const zip = new AdmZip();
  zip.addFile("data.json", Buffer.from(JSON.stringify(bundle, null, 1), "utf8"));
  for (const rel of referencedFiles(tables)) {
    const abs = resolveUpload(rel);
    if (abs) zip.addFile(path.posix.join("files", rel.split(path.sep).join("/")), await readFile(abs));
  }
  return zip.toBuffer();
}

export async function buildConfigJson(): Promise<string> {
  const tables = await dumpTables("config");
  const bundle: Bundle = { version: BUNDLE_VERSION, scope: "config", exportedAt: new Date().toISOString(), tables };
  return JSON.stringify(bundle, null, 2);
}

/* ---------------- import ---------------- */

export function parseBundle(buf: Buffer): { bundle: Bundle; zip: AdmZip | null } {
  let bundle: Bundle;
  let zip: AdmZip | null = null;
  if (buf.subarray(0, 2).toString("latin1") === "PK") {
    zip = new AdmZip(buf);
    const entry = zip.getEntry("data.json");
    if (!entry) throw new Error("הקובץ אינו חבילת גיבוי (חסר data.json).");
    bundle = JSON.parse(entry.getData().toString("utf8"));
  } else {
    try {
      bundle = JSON.parse(buf.toString("utf8"));
    } catch {
      throw new Error("הקובץ אינו חבילת גיבוי תקינה.");
    }
  }
  if (bundle?.version !== BUNDLE_VERSION) throw new Error(`גרסת חבילה לא נתמכת (${bundle?.version ?? "?"}).`);
  if (bundle.scope !== "full" && bundle.scope !== "config") throw new Error("scope לא מזוהה בחבילה.");
  if (!bundle.tables || typeof bundle.tables !== "object") throw new Error("חבילה ללא נתונים.");
  return { bundle, zip };
}

const rows = (t: Tables, k: string) => (t[k] ?? []) as never[];

/** Wipe + insert, one transaction, original ids preserved. Returns row counts. */
async function restoreDb(bundle: Bundle): Promise<Record<string, number>> {
  const t = bundle.tables;
  const full = bundle.scope === "full";

  const ops = [
    // transient first (reference users/people/rules)
    prisma.agentRun.deleteMany(),
    prisma.personDraft.deleteMany(),
    prisma.extractionProposal.deleteMany(),
    // reverse dependency order
    prisma.planCarryOver.deleteMany(),
    prisma.planWaiver.deleteMany(),
    prisma.planAssignment.deleteMany(),
    prisma.attachment.deleteMany(),
    prisma.evalEntry.deleteMany(),
    prisma.metricReading.deleteMany(),
    prisma.pointProgress.deleteMany(),
    prisma.personFieldValue.deleteMany(),
    prisma.rule.deleteMany(),
    prisma.person.deleteMany(),
    prisma.metricCheckpoint.deleteMany(),
    prisma.cumulativeMetric.deleteMany(),
    prisma.pointEvent.deleteMany(),
    prisma.recurringEvent.deleteMany(),
    prisma.careerPlan.deleteMany(),
    prisma.accessGrant.deleteMany(),
    prisma.user.deleteMany(),
    prisma.orgNode.deleteMany(),
    prisma.personFieldDef.deleteMany(),
    prisma.appSetting.deleteMany(),
    // forward order inserts
    prisma.appSetting.createMany({ data: rows(t, "appSetting") }),
    prisma.personFieldDef.createMany({ data: rows(t, "personFieldDef") }),
    prisma.orgNode.createMany({ data: rows(t, "orgNode") }),
    prisma.careerPlan.createMany({ data: rows(t, "careerPlan") }),
    prisma.pointEvent.createMany({ data: rows(t, "pointEvent") }),
    prisma.cumulativeMetric.createMany({ data: rows(t, "cumulativeMetric") }),
    prisma.metricCheckpoint.createMany({ data: rows(t, "metricCheckpoint") }),
    prisma.recurringEvent.createMany({ data: rows(t, "recurringEvent") }),
    prisma.user.createMany({ data: rows(t, "user") }),
    prisma.accessGrant.createMany({ data: rows(t, "accessGrant") }),
    ...(full
      ? [
          prisma.person.createMany({ data: rows(t, "person") }),
          prisma.personFieldValue.createMany({ data: rows(t, "personFieldValue") }),
          prisma.pointProgress.createMany({ data: rows(t, "pointProgress") }),
          prisma.metricReading.createMany({ data: rows(t, "metricReading") }),
          prisma.evalEntry.createMany({ data: rows(t, "evalEntry") }),
          prisma.attachment.createMany({ data: rows(t, "attachment") }),
          prisma.rule.createMany({ data: rows(t, "rule") }),
          prisma.planAssignment.createMany({ data: rows(t, "planAssignment") }),
          prisma.planWaiver.createMany({ data: rows(t, "planWaiver") }),
          prisma.planCarryOver.createMany({ data: rows(t, "planCarryOver") }),
        ]
      : []),
  ];
  await prisma.$transaction(ops, { timeout: 60_000 });

  return {
    people: rows(t, "person").length,
    users: rows(t, "user").length,
    plans: rows(t, "careerPlan").length,
    nodes: rows(t, "orgNode").length,
  };
}

/** Restore bundled files into uploads/ (after a successful DB commit). */
async function restoreFiles(zip: AdmZip): Promise<number> {
  await rm(UPLOADS_ROOT, { recursive: true, force: true });
  await mkdir(UPLOADS_ROOT, { recursive: true });
  let n = 0;
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory || !entry.entryName.startsWith("files/")) continue;
    const rel = entry.entryName.slice("files/".length);
    const abs = path.resolve(UPLOADS_ROOT, rel);
    if (!abs.startsWith(path.resolve(UPLOADS_ROOT))) continue; // traversal guard
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, entry.getData());
    n++;
  }
  return n;
}

export async function importBundleBuffer(buf: Buffer): Promise<{ scope: BundleScope; counts: Record<string, number>; files: number }> {
  const { bundle, zip } = parseBundle(buf);

  if (bundle.scope === "config") {
    const people = await prisma.person.count();
    if (people > 0) {
      throw new Error("ייבוא תצורה מותר רק למערכת ללא אנשים במרשם. השתמש בגיבוי מלא לשחזור.");
    }
  }

  let counts: Record<string, number>;
  try {
    counts = await restoreDb(bundle);
  } catch {
    // transaction rolled back — nothing changed
    throw new Error("החבילה מכילה נתונים לא-עקביים (הפרת קשרים או שדות חסרים) — לא בוצע שום שינוי.");
  }
  let files = 0;
  if (bundle.scope === "full" && zip) files = await restoreFiles(zip);
  return { scope: bundle.scope, counts, files };
}

export function uploadsRootExists(): boolean {
  return existsSync(UPLOADS_ROOT);
}
