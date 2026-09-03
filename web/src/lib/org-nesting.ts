import type { OrgKind } from "@/generated/prisma/client";

/**
 * How the four kinds nest — stated ONCE, because two places enforce it: the
 * hierarchy form, which adds a framework at a time, and the file importer,
 * which adds a whole tree. A second copy is a second truth, and the one that
 * drifts is the one nobody was looking at.
 */
export const PARENT_KIND: Record<Exclude<OrgKind, "CENTER">, OrgKind> = {
  DOMAIN: "CENTER",
  SECTION: "DOMAIN",
  TEAM: "SECTION",
};

export const CHILD_KIND: Record<OrgKind, OrgKind | null> = {
  CENTER: "DOMAIN",
  DOMAIN: "SECTION",
  SECTION: "TEAM",
  TEAM: null,
};

export const KIND_LABEL: Record<OrgKind, string> = {
  CENTER: "מרכז",
  DOMAIN: "תחום",
  SECTION: "מדור",
  TEAM: "צוות",
};

/** Roots-first, so a parent always exists before the children that name it. */
export const KIND_ORDER: OrgKind[] = ["CENTER", "DOMAIN", "SECTION", "TEAM"];

export function isOrgKind(v: string): v is OrgKind {
  return KIND_ORDER.includes(v as OrgKind);
}
