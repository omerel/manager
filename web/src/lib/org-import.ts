import type { OrgKind } from "@/generated/prisma/client";
import { CHILD_KIND, KIND_LABEL, KIND_ORDER, PARENT_KIND, isOrgKind } from "@/lib/org-nesting";

/**
 * Building the whole org tree from one file.
 *
 * Three stages, and the order matters: the columns are MAPPED and the mapping
 * approved, only then are the rows validated — by the columns the admin chose,
 * never by the ones the system guessed. Nothing is written until the report is
 * clean and the cost has been confirmed.
 */

export type OrgMeaning = "name" | "kind" | "parent";
export type OrgTarget = OrgMeaning | "ignore";
export type OrgMapping = { header: string; target: OrgTarget }[];

export const MEANING_LABEL: Record<OrgMeaning, string> = {
  name: "שם המסגרת",
  kind: "סוג המסגרת",
  parent: "מסגרת אב",
};

const norm = (s: string) => s.replace(/["'׳״.\-_/\\()]/g, "").replace(/\s+/g, "").toLowerCase();

/** Header variants per meaning. Anything else is left alone, never guessed at. */
const VARIANTS: [OrgMeaning, string[]][] = [
  ["name", ["שם", "שםמסגרת", "שםהמסגרת", "מסגרת", "name", "framework", "unit"]],
  ["kind", ["סוג", "סוגמסגרת", "סוגהמסגרת", "רמה", "דרג", "kind", "type", "level"]],
  ["parent", ["אב", "מסגרתאב", "אבא", "הורה", "כפיפות", "תחת", "parent", "parentname", "reportsto"]],
];

/** Kind cell → OrgKind. Accepts the Hebrew labels and the enum names alike. */
const KIND_BY_TEXT = new Map<string, OrgKind>([
  ...KIND_ORDER.map((k) => [norm(KIND_LABEL[k]), k] as [string, OrgKind]),
  ...KIND_ORDER.map((k) => [norm(k), k] as [string, OrgKind]),
  ["מרכזי", "CENTER"],
  ["ראשי", "CENTER"],
]);

/**
 * The parsed sheet. Parsing itself is NOT here: it lives in `hr-import`, which
 * reaches the database, and this module is imported by the client component —
 * one prisma import in that chain and the browser bundle fails on `dns`.
 */
export type OrgParsed = { headers: string[]; rows: string[][] };

/**
 * Propose a mapping from the file's own headers.
 *
 * A column the system does not recognise becomes `ignore` — the file may carry
 * anything else, and a guess here would be a guess about the shape of a unit.
 * The first column to claim a meaning keeps it; a later duplicate is ignored,
 * and the admin may re-point either.
 */
export function recognizeOrgHeaders(headers: string[]): OrgMapping {
  const byVariant = new Map<string, OrgMeaning>();
  for (const [meaning, variants] of VARIANTS) for (const v of variants) byVariant.set(v, meaning);
  const taken = new Set<OrgMeaning>();
  return headers.map((header) => {
    const hit = byVariant.get(norm(header));
    if (hit && !taken.has(hit)) {
      taken.add(hit);
      return { header, target: hit as OrgTarget };
    }
    return { header, target: "ignore" as OrgTarget };
  });
}

export type OrgFault = {
  /** 1-based row in the file, counting the header as row 1; null for a whole-file fault */
  row: number | null;
  name: string;
  reason: string;
};

export type OrgPlanNode = { name: string; kind: OrgKind; parentName: string | null };

export type OrgValidation = {
  faults: OrgFault[];
  /** level-ordered, roots first — only when there are no faults */
  plan: OrgPlanNode[];
};

/**
 * Every fault in one pass — a validator that stopped at the first would make
 * correcting a sixty-row file a sixty-round trip.
 */
export function validateOrgRows(parsed: OrgParsed, mapping: OrgMapping): OrgValidation {
  const faults: OrgFault[] = [];
  const col = (m: OrgMeaning) => mapping.findIndex((c) => c.target === m);
  const iName = col("name");
  const iKind = col("kind");
  const iParent = col("parent");

  // a missing meaning is answered BEFORE any row is read: validating rows by a
  // column that was never chosen would report faults about the wrong thing
  for (const m of ["name", "kind", "parent"] as OrgMeaning[]) {
    if (col(m) === -1) faults.push({ row: null, name: "", reason: `לא נבחרה עמודה עבור ${MEANING_LABEL[m]}.` });
  }
  if (faults.length) return { faults, plan: [] };

  const rows = parsed.rows
    .map((r, i) => ({
      row: i + 2, // the header is row 1
      name: (r[iName] ?? "").trim(),
      kindRaw: (r[iKind] ?? "").trim(),
      parent: (r[iParent] ?? "").trim(),
    }))
    .filter((r) => r.name || r.kindRaw || r.parent); // a blank line is not a fault

  if (rows.length === 0) return { faults: [{ row: null, name: "", reason: "הקובץ אינו מכיל שורות." }], plan: [] };

  // how many rows carry each name — an ambiguous parent cannot be resolved, and
  // guessing which branch was meant is exactly the wrong kind of helpfulness
  const nameCount = new Map<string, number>();
  for (const r of rows) if (r.name) nameCount.set(r.name, (nameCount.get(r.name) ?? 0) + 1);

  const kindOf = new Map<string, OrgKind>();
  for (const r of rows) {
    const k = KIND_BY_TEXT.get(norm(r.kindRaw));
    if (k && !kindOf.has(r.name)) kindOf.set(r.name, k);
  }

  const seenSibling = new Set<string>();
  for (const r of rows) {
    if (!r.name) {
      faults.push({ row: r.row, name: "", reason: "חסר שם מסגרת." });
      continue;
    }
    const kind = KIND_BY_TEXT.get(norm(r.kindRaw));
    if (!kind) {
      faults.push({
        row: r.row,
        name: r.name,
        reason: r.kindRaw ? `סוג לא מוכר: ״${r.kindRaw}״. הסוגים: ${KIND_ORDER.map((k) => KIND_LABEL[k]).join(" / ")}.` : "חסר סוג מסגרת.",
      });
      continue;
    }

    if (!r.parent) {
      if (kind !== "CENTER") {
        faults.push({ row: r.row, name: r.name, reason: `${KIND_LABEL[kind]} חייב מסגרת אב; ללא אב מותר ${KIND_LABEL.CENTER} בלבד.` });
      }
    } else {
      const parentCount = nameCount.get(r.parent) ?? 0;
      if (parentCount === 0) {
        faults.push({ row: r.row, name: r.name, reason: `מסגרת האב ״${r.parent}״ אינה מופיעה בקובץ.` });
      } else if (parentCount > 1) {
        faults.push({ row: r.row, name: r.name, reason: `שם מסגרת האב ״${r.parent}״ מופיע ${parentCount} פעמים — לא ניתן לדעת לאיזו התכוונת.` });
      } else {
        const parentKind = kindOf.get(r.parent);
        const expected = kind === "CENTER" ? null : PARENT_KIND[kind];
        if (parentKind && expected && parentKind !== expected) {
          faults.push({
            row: r.row,
            name: r.name,
            reason: `אב של ${KIND_LABEL[kind]} חייב להיות ${KIND_LABEL[expected]}, ו״${r.parent}״ הוא ${KIND_LABEL[parentKind]}.`,
          });
        } else if (kind === "CENTER") {
          faults.push({ row: r.row, name: r.name, reason: `${KIND_LABEL.CENTER} אינו יכול להיות תחת מסגרת אחרת.` });
        } else if (parentKind && CHILD_KIND[parentKind] !== kind) {
          faults.push({ row: r.row, name: r.name, reason: `תחת ${KIND_LABEL[parentKind]} יכולים להיות ${KIND_LABEL[CHILD_KIND[parentKind]!]} בלבד.` });
        }
      }
      const siblingKey = `${r.parent}\u0000${r.name}`;
      if (seenSibling.has(siblingKey)) {
        faults.push({ row: r.row, name: r.name, reason: `שם זהה כבר קיים תחת ״${r.parent}״.` });
      }
      seenSibling.add(siblingKey);
    }

    if (!r.parent) {
      const rootKey = `\u0000${r.name}`;
      if (seenSibling.has(rootKey)) faults.push({ row: r.row, name: r.name, reason: "שם שורש זהה מופיע פעמיים." });
      seenSibling.add(rootKey);
    }
  }

  // a chain that closes on itself: walk each row's parents and see if it returns
  const parentOf = new Map(rows.filter((r) => r.name).map((r) => [r.name, r.parent || null]));
  for (const r of rows) {
    if (!r.name) continue;
    const seen = new Set<string>([r.name]);
    let cur = parentOf.get(r.name) ?? null;
    while (cur) {
      if (seen.has(cur)) {
        faults.push({ row: r.row, name: r.name, reason: `שרשרת האב חוזרת אל עצמה (״${cur}״).` });
        break;
      }
      seen.add(cur);
      cur = parentOf.get(cur) ?? null;
    }
  }

  if (faults.length) return { faults, plan: [] };

  // level-ordered, so a parent is always written before the rows naming it
  const plan: OrgPlanNode[] = [];
  for (const kind of KIND_ORDER) {
    for (const r of rows) {
      if (KIND_BY_TEXT.get(norm(r.kindRaw)) !== kind) continue;
      plan.push({ name: r.name, kind, parentName: r.parent || null });
    }
  }
  return { faults: [], plan };
}

/** The plan as a tree, for the preview to draw what the file actually says. */
export type OrgPreviewNode = OrgPlanNode & { children: OrgPreviewNode[] };

export function planAsTree(plan: OrgPlanNode[]): OrgPreviewNode[] {
  const nodes = new Map(plan.map((n) => [n.name, { ...n, children: [] as OrgPreviewNode[] }]));
  const roots: OrgPreviewNode[] = [];
  for (const n of nodes.values()) {
    const parent = n.parentName ? nodes.get(n.parentName) : null;
    if (parent) parent.children.push(n);
    else roots.push(n);
  }
  return roots;
}
