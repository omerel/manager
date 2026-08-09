import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import type { Visibility } from "@/lib/access";
import { formatIsraeliDate } from "@/lib/dates";
import { normalizeIdentity } from "@/lib/identity-keys";
import { parseRowDate, type ColumnMapping, type ColumnTarget, type DateOrder } from "@/lib/hr-import";
import type { ProposalItem } from "@/lib/proposals";

/**
 * The weekly external-update engine. Read-only end to end: its output is
 * PROPOSALS, and a person changes only when a human approves a field.
 *
 * The load-bearing idea is the two-stage diff — each stage answers a different
 * question, and a proposal exists only when both say yes:
 *
 *   file vs previous snapshot → did the FILE change?     (the noise filter)
 *   file vs the system        → does it DIFFER from us?  (the proposal)
 *
 * From this the master rule falls out by construction rather than by check:
 * the file never overrides by silence. A hand correction in the system
 * survives any number of uploads whose cells did not change.
 */

/* ---------------- targets ---------------- */

/** Update targets extend the import's: career values by LABEL, template-wide. */
export type UpdateTarget = ColumnTarget | `point:${string}` | `metric:${string}`;

export type UpdateMapping = { header: string; targets: UpdateTarget[] }[];

/**
 * What the mapping chooser offers for career values: labels across plan
 * TEMPLATES. Labels, not ids — plans are per-person copies, so the mapping
 * speaks a language every copy understands. Evaluations and recurring events
 * are deliberately absent: not update targets, by decision.
 */
export async function careerTargets(): Promise<{ points: string[]; metrics: string[] }> {
  const templates = await prisma.careerPlan.findMany({
    where: { isTemplate: true },
    include: { pointEvents: { select: { label: true } }, cumulativeMetrics: { select: { name: true } } },
  });
  const points = [...new Set(templates.flatMap((t) => t.pointEvents.map((e) => e.label)))].sort((a, b) => a.localeCompare(b, "he"));
  const metrics = [...new Set(templates.flatMap((t) => t.cumulativeMetrics.map((m) => m.name)))].sort((a, b) => a.localeCompare(b, "he"));
  return { points, metrics };
}

/**
 * The same labels WITH their sources — which plan templates carry each — for
 * the mapping picker, where every target names where it lives.
 */
export async function careerTargetSources(): Promise<{
  points: { label: string; templates: string[] }[];
  metrics: { name: string; templates: string[] }[];
}> {
  const templates = await prisma.careerPlan.findMany({
    where: { isTemplate: true },
    include: { pointEvents: { select: { label: true } }, cumulativeMetrics: { select: { name: true } } },
  });
  const points = new Map<string, Set<string>>();
  const metrics = new Map<string, Set<string>>();
  for (const t of templates) {
    for (const e of t.pointEvents) (points.get(e.label) ?? points.set(e.label, new Set()).get(e.label)!).add(t.name);
    for (const m of t.cumulativeMetrics) (metrics.get(m.name) ?? metrics.set(m.name, new Set()).get(m.name)!).add(t.name);
  }
  const sort = (a: string, b: string) => a.localeCompare(b, "he");
  return {
    points: [...points.entries()].map(([label, t]) => ({ label, templates: [...t].sort(sort) })).sort((a, b) => sort(a.label, b.label)),
    metrics: [...metrics.entries()].map(([name, t]) => ({ name, templates: [...t].sort(sort) })).sort((a, b) => sort(a.name, b.name)),
  };
}

/** Labels the saved mapping points at that no template carries any more — surfaced, never silently dead. */
export async function staleMappingTargets(mapping: UpdateMapping): Promise<string[]> {
  const { points, metrics } = await careerTargets();
  const stale: string[] = [];
  for (const col of mapping) {
    for (const t of col.targets) {
      if (t.startsWith("point:") && !points.includes(t.slice(6))) stale.push(`${col.header} → אירוע ״${t.slice(6)}״`);
      if (t.startsWith("metric:") && !metrics.includes(t.slice(7))) stale.push(`${col.header} → מדד ״${t.slice(7)}״`);
    }
  }
  return stale;
}

/* ---------------- the signature ---------------- */

/** Same headers (normalised, order-blind) = same structure = same mapping. */
export function headersSignature(headers: string[]): string {
  const norm = headers.map((h) => h.replace(/["'׳״.\-_/\\()]/g, "").replace(/\s+/g, "").toLowerCase()).sort();
  return createHash("sha256").update(JSON.stringify(norm)).digest("hex").slice(0, 32);
}

export type StructureDiff = { appeared: string[]; vanished: string[] };

export function structureDiff(oldHeaders: string[], newHeaders: string[]): StructureDiff {
  const o = new Set(oldHeaders.map((h) => h.trim()));
  const n = new Set(newHeaders.map((h) => h.trim()));
  return {
    appeared: [...n].filter((h) => !o.has(h)),
    vanished: [...o].filter((h) => !n.has(h)),
  };
}

/* ---------------- the two-stage diff ---------------- */

/** Cells that changed relative to the previous snapshot, keyed by identity. */
export function changedCells(
  headers: string[],
  rows: string[][],
  identityColumnIdx: number,
  previous: { headers: string[]; rows: string[][] } | null,
): Map<string, Set<number>> {
  const out = new Map<string, Set<number>>();
  if (!previous) {
    // first run: no snapshot, EVERY cell passes stage one — the initial feed
    for (const r of rows) {
      const id = normalizeIdentity(r[identityColumnIdx]);
      if (id) out.set(id, new Set(headers.map((_, i) => i)));
    }
    return out;
  }
  // align the old file by identity and by HEADER (column order may differ)
  const oldCol = new Map(previous.headers.map((h, i) => [h.trim(), i]));
  const oldIdIdx = previous.headers.findIndex((h) => h.trim() === headers[identityColumnIdx].trim());
  const oldByIdentity = new Map<string, string[]>();
  if (oldIdIdx >= 0) {
    for (const r of previous.rows) {
      const id = normalizeIdentity(r[oldIdIdx]);
      if (id) oldByIdentity.set(id, r);
    }
  }
  for (const r of rows) {
    const id = normalizeIdentity(r[identityColumnIdx]);
    if (!id) continue;
    const old = oldByIdentity.get(id);
    const changed = new Set<number>();
    headers.forEach((h, i) => {
      const oi = oldCol.get(h.trim());
      const oldVal = old && oi !== undefined ? (old[oi] ?? "").trim() : undefined;
      const newVal = (r[i] ?? "").trim();
      // a person absent from the old file counts as all-changed for stage one
      if (oldVal === undefined || oldVal !== newVal) changed.add(i);
    });
    if (changed.size > 0) out.set(id, changed);
  }
  return out;
}

/* ---------------- proposal building ---------------- */

/** An update-run item: a ProposalItem plus the deletion marker. */
export type UpdateItem = ProposalItem & { kind?: "delete" };

export type PersonUpdate = {
  personId: string;
  fullName: string;
  items: UpdateItem[];
  warnings: string[];
};

export type UpdatePlan = {
  people: PersonUpdate[];
  skippedUnknown: number; // silent by decision, counted for the log only
  skippedOutOfScope: number;
  warnings: string[]; // run-level: stale mapping targets etc.
};

/**
 * Build the proposals: stage-one filter in, per-target compare against the
 * system, out come per-person items — current → proposed, deletions only where
 * emptiness is legal, required-cell emptiness a warning.
 */
export async function buildUpdatePlan(
  visibility: Visibility,
  mapping: UpdateMapping,
  headers: string[],
  rows: string[][],
  changed: Map<string, Set<number>>,
  dateFormats: Record<string, DateOrder> = {},
): Promise<UpdatePlan> {
  const defs = await prisma.personFieldDef.findMany();
  const tzDefId = defs.find((d) => d.label === "תעודת זהות")?.id;
  const paDefId = defs.find((d) => d.label === "מספר אישי")?.id;

  const people = await prisma.person.findMany({
    include: {
      fieldValues: true,
      pointProgress: true,
      metricReadings: true,
      assignedPlan: { include: { pointEvents: true, cumulativeMetrics: true } },
    },
  });
  const byIdentity = new Map<string, (typeof people)[number]>();
  for (const p of people) {
    for (const fv of p.fieldValues) {
      if ((fv.fieldDefId === tzDefId || fv.fieldDefId === paDefId) && normalizeIdentity(fv.value)) {
        byIdentity.set(normalizeIdentity(fv.value), p);
      }
    }
  }

  const plan: UpdatePlan = { people: [], skippedUnknown: 0, skippedOutOfScope: 0, warnings: await staleMappingTargets(mapping) };

  for (const row of rows) {
    // find the person by any identity column in the row — and KEEP the key the
    // row itself matched by. The first draft reverse-looked-up the person's key
    // from the identity index, which could return their OTHER identity value
    // (מספר אישי when the row matched by ת״ז) — and `changed` is keyed by the
    // ROW's value, so the lookup silently missed and muted almost everyone.
    let person: (typeof people)[number] | undefined;
    let matchedKey = "";
    for (let i = 0; i < headers.length; i++) {
      const targets = mapping.find((m) => m.header === headers[i])?.targets ?? [];
      const isIdentity = targets.some((t) => (t.startsWith("custom:") && (t.slice(7) === tzDefId || t.slice(7) === paDefId)));
      if (isIdentity) {
        const key = normalizeIdentity(row[i]);
        const hit = byIdentity.get(key);
        if (hit) { person = hit; matchedKey = key; break; }
      }
    }
    if (!person) { plan.skippedUnknown++; continue; } // silent, by decision
    if (!person.teamId || !visibility.canEdit(person.teamId)) { plan.skippedOutOfScope++; continue; }

    const changedCols = changed.get(matchedKey);
    if (!changedCols || changedCols.size === 0) continue;

    const items: UpdateItem[] = [];
    const warnings: string[] = [];

    headers.forEach((header, colIdx) => {
      if (!changedCols.has(colIdx)) return; // stage one said: unchanged in the file
      const targets = mapping.find((m) => m.header === header)?.targets ?? [];
      const raw = (row[colIdx] ?? "").trim();

      for (const target of targets) {
        const item = compareTarget(person!, target, raw, header, defs, dateFormats[header]);
        if (item === "warn-required-empty") warnings.push(`«${header}» התרוקן — שדה חובה אינו נמחק`);
        else if (item) items.push(item);
      }
    });

    if (items.length > 0 || warnings.length > 0) {
      plan.people.push({ personId: person.id, fullName: person.fullName, items, warnings });
    }
  }
  return plan;
}

type LoadedPerson = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: Date | null;
  recruitmentDate: Date;
  placementDate: Date;
  fieldValues: { fieldDefId: string; value: string }[];
  pointProgress: { pointEventId: string; doneOn: Date }[];
  metricReadings: { metricId: string; value: number }[];
  assignedPlan: { pointEvents: { id: string; label: string }[]; cumulativeMetrics: { id: string; name: string }[] } | null;
};

/**
 * Stage two for one (person, target, value): the current system value against
 * the file's. Equal → null (no proposal). Different → the item. Emptied →
 * a deletion item where legal, the warning marker where required.
 */
function compareTarget(
  person: LoadedPerson,
  target: UpdateTarget,
  raw: string,
  header: string,
  defs: { id: string; label: string; type: string; options: string[] }[],
  order?: DateOrder,
): UpdateItem | "warn-required-empty" | null {
  const dateOf = (v: string) => parseRowDate(v, order);

  // ---- core card dates (required: emptiness warns, never deletes)
  if (target === "birthDate" || target === "recruitmentDate" || target === "placementDate") {
    const labels = { birthDate: "תאריך לידה", recruitmentDate: "תאריך גיוס", placementDate: "תאריך הצבה" } as const;
    const current = person[target] ? formatIsraeliDate(person[target] as Date) : "";
    if (!raw) return current ? "warn-required-empty" : null;
    const d = dateOf(raw);
    if (!d) return null; // unreadable → no proposal; never guessed
    const proposed = formatIsraeliDate(d);
    return proposed === current ? null : { key: target, label: labels[target], current, proposed };
  }

  // ---- configurable fields (custom:<defId> from part 1's mapping language)
  if (target.startsWith("custom:") || target.startsWith("field:")) {
    const defId = target.startsWith("custom:") ? target.slice(7) : target.slice(6);
    const def = defs.find((d) => d.id === defId);
    if (!def) return null;
    const current = person.fieldValues.find((v) => v.fieldDefId === defId)?.value ?? "";
    if (!raw) {
      if (!current) return null;
      return { key: `field:${defId}`, label: def.label, current, proposed: "", kind: "delete" };
    }
    if (def.type === "ENUM" && !def.options.includes(raw)) return null; // illegal value proposes nothing
    if (def.label === "תעודת זהות" || def.label === "מספר אישי") return null; // identity is the KEY, not a payload
    return raw === current ? null : { key: `field:${defId}`, label: def.label, current, proposed: raw };
  }

  // ---- career values, resolved against the PERSON'S OWN plan copy
  if (target.startsWith("point:")) {
    const label = target.slice(6);
    const event = person.assignedPlan?.pointEvents.find((e) => e.label === label);
    if (!event) return null; // not this person's career — silently inapplicable
    const prog = person.pointProgress.find((p) => p.pointEventId === event.id);
    const current = prog ? formatIsraeliDate(prog.doneOn) : "";
    if (!raw) {
      if (!current) return null;
      return { key: `point:${label}`, label: `ביצוע ״${label}״`, current, proposed: "", kind: "delete" };
    }
    const d = dateOf(raw);
    if (!d) return null;
    const proposed = formatIsraeliDate(d);
    return proposed === current ? null : { key: `point:${label}`, label: `ביצוע ״${label}״`, current, proposed };
  }
  if (target.startsWith("metric:")) {
    const name = target.slice(7);
    const metric = person.assignedPlan?.cumulativeMetrics.find((m) => m.name === name);
    if (!metric) return null;
    const reading = person.metricReadings.find((r) => r.metricId === metric.id);
    const current = reading ? String(reading.value) : "";
    if (!raw) {
      if (!current) return null;
      return { key: `metric:${name}`, label: `מדד ״${name}״`, current, proposed: "", kind: "delete" };
    }
    const num = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(num)) return null;
    return String(num) === current ? null : { key: `metric:${name}`, label: `מדד ״${name}״`, current, proposed: String(num) };
  }

  // names are card fields like any other — the master system is where a
  // marriage-changed surname arrives from. Required: emptiness warns.
  if (target === "firstName" || target === "lastName") {
    const current = person[target];
    if (!raw) return current ? "warn-required-empty" : null;
    return raw === current ? null : { key: target, label: target === "firstName" ? "שם פרטי" : "שם משפחה", current, proposed: raw };
  }
  void header;
  return null;
}
