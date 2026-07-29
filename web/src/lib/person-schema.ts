import type { FieldType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/dates";

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
