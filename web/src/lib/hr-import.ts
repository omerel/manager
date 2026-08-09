import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import type { Visibility } from "@/lib/access";
import { parseIsraeliDate, formatIsraeliDate } from "@/lib/dates";
import { normalizeIdentity } from "@/lib/identity-keys";

/**
 * The table-import engine: parse, map, classify. No writing happens here —
 * classification is the preview, and the preview is the exact input of the
 * execution, so what was approved is what runs.
 *
 * The division of labour with the agent, decided up front: the agent may
 * interpret STRUCTURE (which column is which, once, visibly, correctably) and
 * never touches VALUES. Every row goes through this deterministic engine
 * whatever proposed the mapping.
 */

/* ---------------- parsing ---------------- */

export type ParsedTable = { headers: string[]; rows: string[][] };

/**
 * CSV or Excel in, headers + string rows out.
 *
 * `cellDates: true` makes Excel date cells arrive as Date objects instead of
 * serial numbers; they are rendered to dd/mm/yyyy here so the whole engine
 * speaks one date language and `parseIsraeliDate` remains the single gate. A
 * date that arrives as TEXT passes through untouched — the gate decides.
 */
export function parseTable(buffer: Buffer, filename: string): ParsedTable {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true, raw: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("הקובץ ריק — אין בו גיליון.");
  const sheet = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });

  const render = (v: unknown): string => {
    if (v instanceof Date) return formatIsraeliDate(new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate())));
    return String(v ?? "").trim();
  };

  const nonEmpty = matrix.filter((r) => r.some((c) => render(c) !== ""));
  if (nonEmpty.length < 2) throw new Error(`הקובץ ${filename} מכיל פחות משתי שורות — אין כותרות ונתונים.`);
  return {
    headers: nonEmpty[0].map(render),
    rows: nonEmpty.slice(1).map((r) => r.map(render)),
  };
}

/* ---------------- header mapping ---------------- */

/** What a column can mean. Core fields by key; custom fields by `custom:<defId>`. */
export type ColumnTarget =
  | "firstName"
  | "lastName"
  | "fullName"
  | "birthDate"
  | "recruitmentDate"
  | "placementDate"
  | "framework"
  | "ignore"
  | `custom:${string}`;

export type ColumnMapping = { header: string; target: ColumnTarget }[];

const norm = (s: string) => s.replace(/["'׳״.\-_/\\()]/g, "").replace(/\s+/g, "").toLowerCase();

/** Known variants per core target. Matching is on the normalised form. */
const CORE_VARIANTS: [ColumnTarget, string[]][] = [
  ["firstName", ["שםפרטי", "פרטי", "firstname"]],
  ["lastName", ["שםמשפחה", "משפחה", "lastname"]],
  ["fullName", ["שםמלא", "שם", "fullname", "name"]],
  ["birthDate", ["תאריךלידה", "לידה", "birthdate", "dob"]],
  ["recruitmentDate", ["תאריךגיוס", "גיוס", "recruitmentdate"]],
  ["placementDate", ["תאריךהצבה", "הצבה", "תאריךהצבהביחידה", "placementdate"]],
  ["framework", ["מסגרת", "צוות", "יחידה", "מסגרתמשובצת", "שיבוץ", "team", "unit", "framework"]],
];

/** Variants for the custom fields, identity keys included. */
function customVariants(label: string): string[] {
  const base = [norm(label)];
  if (label === "תעודת זהות") base.push("תז", "מספרזהות", "id", "תעודתזהות");
  if (label === "מספר אישי") base.push("מא", "מספראישי", "personalnumber", "מסאישי");
  return base;
}

export type MappingResult = {
  mapping: ColumnMapping;
  /** headers nothing recognised — what the agent gets to interpret */
  unrecognized: string[];
};

/** Deterministic pass: recognise what we can, list what we cannot. */
export async function recognizeHeaders(headers: string[]): Promise<MappingResult> {
  const defs = await prisma.personFieldDef.findMany({ select: { id: true, label: true } });
  const table = new Map<string, ColumnTarget>();
  for (const [target, variants] of CORE_VARIANTS) for (const v of variants) table.set(v, target);
  for (const d of defs) for (const v of customVariants(d.label)) if (!table.has(v)) table.set(v, `custom:${d.id}`);

  const mapping: ColumnMapping = [];
  const unrecognized: string[] = [];
  for (const h of headers) {
    const hit = table.get(norm(h));
    mapping.push({ header: h, target: hit ?? "ignore" });
    if (!hit) unrecognized.push(h);
  }
  return { mapping, unrecognized };
}

/**
 * The agent's one job here: interpret FOREIGN HEADERS, once, visibly.
 *
 * It receives the unrecognised headers and three sample rows — never the whole
 * file, and never the power to touch a value. Its output is a mapping proposal
 * that lands in the preview next to the deterministic ones, marked as the
 * agent's, correctable like any of them. A wrong interpretation shows up as a
 * whole column mislabelled on the approval screen — not as an invented value in
 * a random row.
 */
export async function proposeMappingWithAgent(
  unrecognized: string[],
  headers: string[],
  sampleRows: string[][],
): Promise<Map<string, ColumnTarget>> {
  const { runClaudeRaw } = await import("@/lib/agent");
  const { mkdtemp, rm } = await import("fs/promises");
  const path = await import("path");
  const os = await import("os");

  const defs = await prisma.personFieldDef.findMany({ select: { id: true, label: true } });
  const targets = [
    `firstName · שם פרטי`, `lastName · שם משפחה`, `fullName · שם מלא`,
    `birthDate · תאריך לידה`, `recruitmentDate · תאריך גיוס`, `placementDate · תאריך הצבה ביחידה`,
    `framework · המסגרת/הצוות שהאדם משובץ בו`,
    ...defs.map((d) => `custom:${d.id} · ${d.label}`),
    `ignore · עמודה שאינה שייכת לכרטיס`,
  ];
  const sample = sampleRows.slice(0, 3).map((r) => headers.map((h, i) => `${h}=${r[i] ?? ""}`).join(" | ")).join("\n");
  const prompt = `לפניך כותרות עמודות מקובץ כוח-אדם שלא זוהו אוטומטית, ושורות דוגמה.
שייך כל כותרת אל אחד היעדים. החזר אך ורק JSON: {"<כותרת>":"<target>", ...}

כותרות לא מזוהות: ${unrecognized.join(" | ")}
שורות דוגמה:
${sample}

יעדים אפשריים (target · משמעות):
${targets.map((t) => `- ${t}`).join("\n")}

כללים: אל תמציא יעד שאינו ברשימה; בספק — ignore. אתה משייך עמודות בלבד, לא ערכים.`;

  const dir = await mkdtemp(path.join(os.tmpdir(), "hr-map-"));
  try {
    const { output } = await runClaudeRaw(prompt, dir, 120_000);
    const m = output.match(/\{[\s\S]*\}/);
    const valid = new Set<string>(["firstName","lastName","fullName","birthDate","recruitmentDate","placementDate","framework","ignore",...defs.map((d)=>`custom:${d.id}`)]);
    const out = new Map<string, ColumnTarget>();
    if (m) {
      try {
        const obj = JSON.parse(m[0]) as Record<string, string>;
        for (const [header, target] of Object.entries(obj)) {
          if (unrecognized.includes(header) && valid.has(target)) out.set(header, target as ColumnTarget);
        }
      } catch { /* an unparseable proposal is an empty proposal */ }
    }
    return out;
  } catch {
    // the agent being unavailable must not block the import: the columns stay
    // "ignore" and the human maps them by hand in the preview
    return new Map();
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * A date column's format, as the agent may interpret it: the ORDER of the
 * parts. Interpreting a format is structure work — "this column is
 * year-first" — and re-parsing under it stays deterministic; a value no order
 * can explain (31/02) remains a row error. The agent never rewrites a value.
 */
export type DateOrder = "dmy" | "mdy" | "ymd";

export function parseDateAs(raw: string, order: DateOrder): Date | null {
  const m = /^(\d{1,4})[./\-\s](\d{1,2})[./\-\s](\d{1,4})$/.exec(String(raw ?? "").trim());
  if (!m) return null;
  const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let d: number, mo: number, y: number;
  if (order === "dmy") [d, mo, y] = [a, b, c];
  else if (order === "mdy") [mo, d, y] = [a, b, c];
  else [y, mo, d] = [a, b, c];
  if (y < 100) y += y >= 40 ? 1900 : 2000; // two-digit years, pivoting at 40
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date;
}

/** dd/mm/yyyy via the system gate, or the column's agent-interpreted order. */
export function parseRowDate(raw: string, order?: DateOrder): Date | null {
  return parseIsraeliDate(raw) ?? (order ? parseDateAs(raw, order) : null);
}

/**
 * Ask the agent which ORDER a failing date column is written in. It sees the
 * column header and the failing samples, and may only answer with an order that
 * explains ALL of them — or "invalid", which leaves the rows to their errors.
 */
export async function proposeDateFormatsWithAgent(
  columns: { header: string; samples: string[] }[],
): Promise<Map<string, DateOrder>> {
  if (columns.length === 0) return new Map();
  const { runClaudeRaw } = await import("@/lib/agent");
  const { mkdtemp, rm } = await import("fs/promises");
  const path = await import("path");
  const os = await import("os");

  const prompt = `עמודות תאריך בקובץ כוח-אדם שערכיהן אינם נקראים כ-dd/mm/yyyy.
לכל עמודה, קבע את סדר הרכיבים: "dmy" (יום-חודש-שנה), "mdy", "ymd" — או "invalid" אם אף סדר אינו מסביר את כל הדוגמאות.
החזר אך ורק JSON: {"<כותרת>":"dmy|mdy|ymd|invalid", ...}

${columns.map((c) => `- ${c.header}: ${c.samples.slice(0, 5).join(" | ")}`).join("\n")}

כלל: אתה קובע פורמט של עמודה, לא מתקן ערכים. בספק — invalid.`;

  const dir = await mkdtemp(path.join(os.tmpdir(), "hr-datefmt-"));
  try {
    const { output } = await runClaudeRaw(prompt, dir, 120_000);
    const m = output.match(/\{[\s\S]*\}/);
    const out = new Map<string, DateOrder>();
    if (m) {
      try {
        const obj = JSON.parse(m[0]) as Record<string, string>;
        for (const [header, order] of Object.entries(obj)) {
          if (order === "dmy" || order === "mdy" || order === "ymd") out.set(header, order);
        }
      } catch { /* unparseable proposal = no proposal */ }
    }
    return out;
  } catch {
    return new Map(); // no agent → the rows keep their honest errors
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** The date-targeted columns whose values the standard gate cannot read — the agent's input. */
export function failingDateColumns(mapping: ColumnMapping, rows: string[][]): { header: string; samples: string[] }[] {
  const out: { header: string; samples: string[] }[] = [];
  mapping.forEach((m, i) => {
    if (m.target !== "birthDate" && m.target !== "recruitmentDate" && m.target !== "placementDate") return;
    const failing = rows.map((r) => (r[i] ?? "").trim()).filter((v) => v && !parseIsraeliDate(v));
    if (failing.length > 0) out.push({ header: m.header, samples: [...new Set(failing)] });
  });
  return out;
}

/* ---------------- framework resolution ---------------- */

export type TeamResolution =
  | { ok: true; teamId: string; path: string }
  | { ok: false; reason: string };

/**
 * A framework name from a row (or a document), resolved WITHIN the operator's
 * edit scope only. One resolver for the table import and the intake extraction
 * alike — same silence about what exists beyond the scope, same refusal to
 * guess between namesakes.
 *
 * Accepts a bare team name, or a path fragment ("מדור א / צוות ב" or with ▸)
 * whose last element is the team and whose earlier elements must appear in the
 * team's real path — how a file says which of two namesakes it means.
 */
export function resolveTeamByName(
  visibility: Visibility,
  nodes: { id: string; name: string; parentId: string | null; kind: string }[],
  raw: string,
): TeamResolution {
  const wanted = String(raw ?? "").trim();
  if (!wanted) return { ok: false, reason: "לא צוינה מסגרת" };

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const pathOf = (id: string): string[] => {
    const parts: string[] = [];
    let cur = byId.get(id);
    while (cur) {
      parts.unshift(cur.name);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return parts;
  };

  const segments = wanted.split(/[▸/\\>]+/).map((s) => s.trim()).filter(Boolean);
  const teamName = segments[segments.length - 1];
  const context = segments.slice(0, -1);

  const candidates = nodes.filter(
    (n) => n.kind === "TEAM" && visibility.canEdit(n.id) && n.name.trim() === teamName,
  );
  const matching = context.length
    ? candidates.filter((c) => {
        const p = pathOf(c.id);
        return context.every((seg) => p.includes(seg));
      })
    : candidates;

  if (matching.length === 1) return { ok: true, teamId: matching[0].id, path: pathOf(matching[0].id).join(" ▸ ") };
  if (matching.length === 0) {
    return { ok: false, reason: `מסגרת ״${wanted}״ לא נמצאה בתחום העריכה שלך` };
  }
  return {
    ok: false,
    reason: `שתי מסגרות בשם ״${teamName}״ בתחומך (${matching.map((m) => pathOf(m.id).join(" ▸ ")).join(" | ")}) — ציין מסלול`,
  };
}

/* ---------------- classification ---------------- */

export type RowPlan =
  | { kind: "skip"; row: number; name: string; reason: string; personId: string }
  | { kind: "error"; row: number; name: string; reason: string }
  | { kind: "duplicate-halt"; row: number; name: string; reason: string; personId: string }
  | {
      kind: "create";
      row: number;
      name: string;
      /** null = ייקלט ללא מסגרת — the row's framework was empty or unresolvable */
      teamId: string | null;
      teamPath: string | null;
      /** non-blocking faults: optional values dropped, framework unresolved — shown before approval */
      warnings: string[];
      data: {
        firstName: string;
        lastName: string;
        birthDate: string; // dd/mm/yyyy, validated
        recruitmentDate: string;
        placementDate: string;
        custom: { fieldDefId: string; value: string }[];
      };
    };

export type ImportPlan = {
  rows: RowPlan[];
  counts: { create: number; skip: number; error: number; halt: number };
};

type RowValues = Partial<Record<ColumnTarget, string>> & { customs: { fieldDefId: string; value: string }[] };

function valuesOf(mapping: ColumnMapping, row: string[]): RowValues {
  const out: RowValues = { customs: [] };
  mapping.forEach((m, i) => {
    const v = (row[i] ?? "").trim();
    if (!v || m.target === "ignore") return;
    if (m.target.startsWith("custom:")) out.customs.push({ fieldDefId: m.target.slice(7), value: v });
    else out[m.target] = v;
  });
  return out;
}

function splitName(v: RowValues): { first: string; last: string } | null {
  if (v.firstName && v.lastName) return { first: v.firstName, last: v.lastName };
  if (v.fullName) {
    const parts = v.fullName.split(/\s+/);
    if (parts.length >= 2) return { first: parts[0], last: parts.slice(1).join(" ") };
    return { first: v.fullName, last: "" };
  }
  return null;
}

/**
 * Classify every row — read-only. The identity defs are read once; each row is
 * matched תעודת זהות first, then מספר אישי, per the fixed order.
 */
export async function classifyRows(
  visibility: Visibility,
  mapping: ColumnMapping,
  rows: string[][],
  /** agent-interpreted order per date COLUMN header, for values dd/mm/yyyy cannot read */
  dateFormats: Record<string, DateOrder> = {},
): Promise<ImportPlan> {
  const [allDefs, nodes, people] = await Promise.all([
    prisma.personFieldDef.findMany({ select: { id: true, label: true, type: true, options: true } }),
    prisma.orgNode.findMany({ select: { id: true, name: true, parentId: true, kind: true } }),
    prisma.person.findMany({
      select: {
        id: true,
        fullName: true,
        teamId: true,
        fieldValues: { select: { fieldDefId: true, value: true } },
      },
    }),
  ]);
  const tzDef = allDefs.find((d) => d.label === "תעודת זהות")?.id;
  const paDef = allDefs.find((d) => d.label === "מספר אישי")?.id;

  // identity → person, built once for the whole file
  const holders = new Map<string, { personId: string; fullName: string; teamId: string | null }>();
  for (const p of people) {
    for (const fv of p.fieldValues) {
      if (fv.fieldDefId !== tzDef && fv.fieldDefId !== paDef) continue;
      const key = `${fv.fieldDefId}:${normalizeIdentity(fv.value)}`;
      if (normalizeIdentity(fv.value)) holders.set(key, { personId: p.id, fullName: p.fullName, teamId: p.teamId });
    }
  }
  const namesInScope = new Map<string, { personId: string; hasIdentity: boolean }>();
  for (const p of people) {
    if (!p.teamId || !visibility.canEdit(p.teamId)) continue;
    const hasIdentity = p.fieldValues.some(
      (fv) => (fv.fieldDefId === tzDef || fv.fieldDefId === paDef) && normalizeIdentity(fv.value),
    );
    namesInScope.set(p.fullName.trim(), { personId: p.id, hasIdentity });
  }

  const plans: RowPlan[] = [];
  rows.forEach((raw, idx) => {
    const rowNo = idx + 2; // 1-based, after the header row
    const v = valuesOf(mapping, raw);
    const name = splitName(v);
    const display = name ? `${name.first} ${name.last}`.trim() : `שורה ${rowNo}`;

    // identity match, fixed order
    const tzVal = v.customs.find((c) => c.fieldDefId === tzDef)?.value;
    const paVal = v.customs.find((c) => c.fieldDefId === paDef)?.value;
    const tzHit = tzVal && tzDef ? holders.get(`${tzDef}:${normalizeIdentity(tzVal)}`) : undefined;
    const paHit = paVal && paDef ? holders.get(`${paDef}:${normalizeIdentity(paVal)}`) : undefined;

    if (tzHit && paHit && tzHit.personId !== paHit.personId) {
      plans.push({
        kind: "error", row: rowNo, name: display,
        reason: `סתירת מפתחות: תעודת הזהות שייכת ל${tzHit.fullName} והמספר האישי ל${paHit.fullName}`,
      });
      return;
    }
    const hit = tzHit ?? paHit;
    if (hit) {
      if (hit.teamId && visibility.canEdit(hit.teamId)) {
        plans.push({ kind: "skip", row: rowNo, name: display, reason: "קיים במערכת בתחומך", personId: hit.personId });
      } else {
        // deliberately unnamed framework: what exists beyond the scope stays beyond it
        plans.push({ kind: "error", row: rowNo, name: display, reason: "קיים במערכת במסגרת אחרת — לא ניתן להוסיף" });
      }
      return;
    }

    // unmatched → a candidate; first the guard for the identity-less
    if (!name) {
      plans.push({ kind: "error", row: rowNo, name: display, reason: "אין שם — נדרשים שם פרטי ומשפחה או שם מלא" });
      return;
    }
    const sameName = namesInScope.get(display);
    if (sameName && !sameName.hasIdentity) {
      plans.push({
        kind: "duplicate-halt", row: rowNo, name: display, personId: sameName.personId,
        reason: "ייתכן כפיל: אדם בשם זהה קיים בתחומך ללא ערך זהות להשוואה. השלם לו תעודת זהות והרץ שוב",
      });
      return;
    }

    // Dates. REQUIRED ones go through the gate — dd/mm/yyyy, or the column's
    // agent-interpreted order — and still block the row when unreadable: a
    // person without a birth date cannot be created at all. OPTIONAL ones obey
    // the softer rule: a bad value is DROPPED with a warning, and the person is
    // taken in with the rest of their details.
    const warnings: string[] = [];
    const orderOfColumn = (field: string): DateOrder | undefined => {
      const idx = mapping.findIndex((m) => m.target === field);
      return idx >= 0 ? dateFormats[mapping[idx].header] : undefined;
    };
    const dates: Record<string, string> = {};
    for (const [field, label, required] of [
      ["birthDate", "תאריך לידה", true],
      ["recruitmentDate", "תאריך גיוס", true],
      ["placementDate", "תאריך הצבה", false],
    ] as const) {
      const rawVal = v[field];
      if (!rawVal) {
        if (required) {
          plans.push({ kind: "error", row: rowNo, name: display, reason: `חסר ${label}` });
          return;
        }
        continue;
      }
      const d = parseRowDate(rawVal, orderOfColumn(field));
      if (!d) {
        if (required) {
          plans.push({ kind: "error", row: rowNo, name: display, reason: `${label} ״${rawVal}״ אינו תאריך קריא באף פורמט` });
          return;
        }
        warnings.push(`${label} ״${rawVal}״ אינו קריא — הערך הושמט`);
        continue;
      }
      dates[field] = formatIsraeliDate(d);
    }

    // Custom values: an ENUM value outside its options is dropped with a
    // warning, never written and never guessed at.
    const enumOptions = new Map(allDefs.filter((d) => d.type === "ENUM").map((d) => [d.id, d.options]));
    const customs = v.customs.filter((c) => {
      const opts = enumOptions.get(c.fieldDefId);
      if (opts && !opts.includes(c.value)) {
        const label = allDefs.find((d) => d.id === c.fieldDefId)?.label ?? "שדה";
        warnings.push(`${label} ״${c.value}״ אינו ערך מותר — הושמט`);
        return false;
      }
      return true;
    });

    // The framework. Empty or unresolvable does NOT block the person any more:
    // they are taken in WITHOUT a framework, the reason carried as a warning to
    // read before approval. An AUTHORITY refusal stays a hard error — softening
    // it to an unassigned create would be a bypass of the establishment rule.
    let teamId: string | null = null;
    let teamPath: string | null = null;
    const team = resolveTeamByName(visibility, nodes, v.framework ?? "");
    if (team.ok) {
      if (!visibility.mayEstablishAt(team.teamId)) {
        plans.push({
          kind: "error", row: rowNo, name: display,
          reason: `אין לך סמכות הקמה על ${team.path} — נדרשת הרשאת עריכה מדרג מדור ומעלה`,
        });
        return;
      }
      teamId = team.teamId;
      teamPath = team.path;
    } else {
      warnings.push(`${team.reason} — ייקלט ללא מסגרת`);
    }

    plans.push({
      kind: "create", row: rowNo, name: display, teamId, teamPath, warnings,
      data: {
        firstName: name.first,
        lastName: name.last,
        birthDate: dates.birthDate,
        recruitmentDate: dates.recruitmentDate,
        placementDate: dates.placementDate ?? dates.recruitmentDate,
        custom: customs,
      },
    });
  });

  return {
    rows: plans,
    counts: {
      create: plans.filter((p) => p.kind === "create").length,
      skip: plans.filter((p) => p.kind === "skip").length,
      error: plans.filter((p) => p.kind === "error").length,
      halt: plans.filter((p) => p.kind === "duplicate-halt").length,
    },
  };
}
