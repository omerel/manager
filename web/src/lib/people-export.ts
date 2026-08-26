import type { EmploymentStatus, FieldType } from "@/generated/prisma/client";
import { formatIsraeliDate, parseIsraeliDate } from "@/lib/dates";
import { CORE_FIELDS } from "@/lib/person-schema";
import { STATUS_LABEL } from "@/lib/people";

/**
 * The column catalogue behind the Excel export — one list, two consumers.
 *
 * The dialog renders it as checkboxes and the route reads people through it, so
 * a card field added to the system becomes an export column with no second
 * place to remember. The core half is derived from `CORE_FIELDS`, which exists
 * for exactly this reason: those names had already drifted apart once when two
 * places listed them independently.
 */

/** What a row needs to answer every column. Shaped by the route's own query. */
export type ExportPerson = {
  firstName: string;
  lastName: string;
  fullName: string;
  birthDate: Date | null;
  recruitmentDate: Date;
  placementDate: Date;
  status: EmploymentStatus;
  endOfServiceDate: Date | null;
  orgPath: string;
  planName: string | null;
  fieldValues: { fieldDefId: string; value: string }[];
};

export type ExportColumn = { key: string; label: string; get: (p: ExportPerson) => string };

/** A custom card field's column key. `field:` keeps it apart from any core key. */
export const customKey = (defId: string) => `field:${defId}`;

/**
 * `dd/mm/yyyy`, not the card's long Hebrew form: this is the format the HR
 * import itself reads, so an exported file can be edited and fed back in. It is
 * also sortable in Excel, and — unlike `fmtDate` — an absent date comes out
 * EMPTY rather than as the screen's «—».
 */
const date = (d: Date | null | undefined) => formatIsraeliDate(d);

/** Core columns, in the order `CORE_FIELDS` names them to the Admin. */
const CORE: ExportColumn[] = [
  { key: "firstName", label: CORE_FIELDS.form[0], get: (p) => p.firstName },
  { key: "lastName", label: CORE_FIELDS.form[1], get: (p) => p.lastName },
  { key: "birthDate", label: CORE_FIELDS.form[2], get: (p) => date(p.birthDate) },
  { key: "recruitmentDate", label: CORE_FIELDS.form[3], get: (p) => date(p.recruitmentDate) },
  { key: "placementDate", label: CORE_FIELDS.form[4], get: (p) => date(p.placementDate) },
  { key: "status", label: CORE_FIELDS.form[5], get: (p) => STATUS_LABEL[p.status] },
  { key: "endOfServiceDate", label: CORE_FIELDS.form[6], get: (p) => date(p.endOfServiceDate) },
  // «שיוך לצוות» is carried as the full path: a bare team name repeats across
  // branches and would not identify the framework in a file read elsewhere
  { key: "orgPath", label: CORE_FIELDS.elsewhere[0], get: (p) => p.orgPath },
  { key: "planName", label: CORE_FIELDS.elsewhere[2], get: (p) => p.planName ?? "" },
];

/** Core columns plus one per Admin-defined card field, in the Admin's order. */
export function exportColumns(defs: { id: string; label: string; type: FieldType }[]): ExportColumn[] {
  return [
    ...CORE,
    ...defs.map((d) => ({
      key: customKey(d.id),
      label: d.label,
      get: (p: ExportPerson) => {
        const raw = p.fieldValues.find((v) => v.fieldDefId === d.id)?.value ?? "";
        if (!raw) return ""; // an absent value is an EMPTY CELL, never the screen's «—»
        if (d.type !== "DATE") return raw;
        const parsed = parseIsraeliDate(raw);
        return parsed ? formatIsraeliDate(parsed) : raw; // unreadable stays as stored, never reinterpreted
      },
    })),
  ];
}

/** Header row + one row per person — the sheet, as an array of arrays. */
export function buildPeopleSheet(people: ExportPerson[], columns: ExportColumn[]): string[][] {
  return [columns.map((c) => c.label), ...people.map((p) => columns.map((c) => c.get(p)))];
}

/** The chosen keys, narrowed to real columns and kept in catalogue order. */
export function chooseColumns(all: ExportColumn[], keys: string[]): ExportColumn[] {
  // an unknown key is dropped rather than refused: a dialog left open while the
  // Admin deletes a card field must not fail the export
  const wanted = new Set(keys);
  return all.filter((c) => wanted.has(c.key));
}
