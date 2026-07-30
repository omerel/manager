import type { OrgKind } from "@/generated/prisma/client";

/**
 * Client-safe org-kind labels. Kept out of `@/lib/org`, which reaches the
 * database and therefore cannot be imported from a client component.
 */
export type OrgKindStr = OrgKind;

export const KIND_LABEL: Record<OrgKind, string> = {
  CENTER: "מרכז",
  DOMAIN: "תחום",
  SECTION: "מדור",
  TEAM: "צוות",
};
