import type { FieldType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/dates";

/**
 * The fixed fields of a person — the ones the Admin does *not* define, and the
 * whole point of the card-schema page is telling them apart from the ones they
 * do. Stated once, because the page names them in two places and those two had
 * already drifted apart from each other and from the form.
 *
 * The first group is what `PersonFormFields` renders; the second is fixed just
 * as firmly but set elsewhere (placement on creation, photo on upload, plan on
 * assignment), which is exactly why it kept being forgotten.
 */
export const CORE_FIELDS = {
  form: ["שם פרטי", "שם משפחה", "תאריך לידה", "תאריך גיוס", "תאריך הצבה ביחידה", "סטטוס העסקה", "תאריך סיום שירות (תת״ש)"],
  elsewhere: ["שיוך לצוות", "תמונת פרופיל", "מסלול קריירה"],
} as const;

/** All of them, in the order the admin meets them. */
export const ALL_CORE_FIELDS: readonly string[] = [...CORE_FIELDS.form, ...CORE_FIELDS.elsewhere];

export const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  TEXT: "טקסט",
  DATE: "תאריך",
  NUMBER: "מספר",
  ENUM: "בחירה",
};

export async function getFieldDefs() {
  return prisma.personFieldDef.findMany({ orderBy: [{ order: "asc" }, { label: "asc" }] });
}

/** Render a stored (string) value according to its field type. */
export function formatFieldValue(type: FieldType, value: string): string {
  if (!value) return "—";
  if (type === "DATE") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? value : fmtDate(d);
  }
  return value;
}
