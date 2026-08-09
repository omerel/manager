import { prisma } from "@/lib/prisma";

/**
 * The two identity keys: תעודת זהות and מספר אישי.
 *
 * They live as ordinary configurable fields (`PersonFieldValue`), which is why
 * nothing in the database makes them unique — and a key that is not enforced is
 * not a key. Enforcement sits here, in the writing layer, used by manual
 * create/edit and by the bulk import alike.
 *
 * DECLARED COMPROMISE: an application-layer check is weaker than a unique
 * index — two parallel writers could theoretically slip through in the same
 * instant. A real index would require restructuring the generic field-value
 * table; the window is narrow and the price was judged too high. If this ever
 * bites, that judgement is what to revisit.
 */

export const IDENTITY_LABELS = ["תעודת זהות", "מספר אישי"] as const;

export type IdentityHit = { personId: string; fullName: string; label: string; value: string };

/** Normalise an identity value for comparison: digits only, no separators. */
export function normalizeIdentity(raw: string | null | undefined): string {
  return String(raw ?? "").replace(/\D/g, "");
}

/** The identity field definitions, keyed by label. */
export async function identityDefs() {
  const defs = await prisma.personFieldDef.findMany({
    where: { label: { in: [...IDENTITY_LABELS] } },
    select: { id: true, label: true },
  });
  return new Map(defs.map((d) => [d.label, d.id]));
}

/**
 * Who already holds these identity values, excluding one person (the one being
 * edited — their own values belong to them).
 */
export async function identityHolders(
  values: { label: string; value: string }[],
  exceptPersonId?: string,
): Promise<IdentityHit[]> {
  const wanted = values
    .map((v) => ({ label: v.label, value: normalizeIdentity(v.value) }))
    .filter((v) => v.value.length > 0);
  if (wanted.length === 0) return [];

  const rows = await prisma.personFieldValue.findMany({
    where: {
      field: { label: { in: wanted.map((w) => w.label) } },
      ...(exceptPersonId ? { personId: { not: exceptPersonId } } : {}),
    },
    select: { value: true, field: { select: { label: true } }, person: { select: { id: true, fullName: true } } },
  });
  return rows
    .filter((r) => wanted.some((w) => w.label === r.field.label && w.value === normalizeIdentity(r.value)))
    .map((r) => ({ personId: r.person.id, fullName: r.person.fullName, label: r.field.label, value: r.value }));
}

/**
 * Refuse a write that would give this person an identity value someone else
 * already holds. Called with the values ABOUT to be written.
 */
export async function assertIdentityFree(
  values: { label: string; value: string }[],
  exceptPersonId?: string,
): Promise<void> {
  const hits = await identityHolders(values, exceptPersonId);
  if (hits.length > 0) {
    const h = hits[0];
    throw new Error(`${h.label} ${h.value} כבר רשומה במערכת על שם ${h.fullName}. ערך זהות שייך לאדם אחד.`);
  }
}

/**
 * Find a person by identity values, in the fixed order: תעודת זהות first, then
 * מספר אישי. Returns every distinct person the values point at — one is a
 * match, two is a key conflict the caller must refuse.
 */
export async function findByIdentity(values: { tz?: string; personalNumber?: string }): Promise<IdentityHit[]> {
  const lookups: { label: string; value: string }[] = [];
  if (normalizeIdentity(values.tz)) lookups.push({ label: "תעודת זהות", value: values.tz! });
  if (normalizeIdentity(values.personalNumber)) lookups.push({ label: "מספר אישי", value: values.personalNumber! });
  if (lookups.length === 0) return [];
  const hits = await identityHolders(lookups);
  // distinct people, first key's hit first
  const seen = new Set<string>();
  const ordered = [...hits.filter((h) => h.label === "תעודת זהות"), ...hits.filter((h) => h.label === "מספר אישי")];
  return ordered.filter((h) => (seen.has(h.personId) ? false : (seen.add(h.personId), true)));
}
