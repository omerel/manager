/** Display name kept in sync with the two stored parts (see design D4). */
export function composeFullName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") || "ללא שם";
}

/** Split a legacy single-field name on the first space. */
export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

/** Age derived from a birth date — years and months, never stored. */
export function ageFromBirthDate(birthDate: Date | null | undefined, now = new Date()): string {
  if (!birthDate) return "—";
  let months =
    (now.getUTCFullYear() - birthDate.getUTCFullYear()) * 12 + (now.getUTCMonth() - birthDate.getUTCMonth());
  if (now.getUTCDate() < birthDate.getUTCDate()) months -= 1;
  if (months < 0) return "—";
  const y = Math.floor(months / 12);
  const m = months % 12;
  const yearPart = y === 1 ? "שנה" : `${y} שנים`;
  const monthPart = m === 1 ? "חודש" : `${m} חודשים`;
  if (y === 0) return monthPart;
  if (m === 0) return yearPart;
  return `${yearPart} ו-${monthPart}`;
}
