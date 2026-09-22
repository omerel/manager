import type { OrgKind } from "@/generated/prisma/client";

/**
 * How the kinds nest — stated ONCE, because two places enforce it: the
 * hierarchy form, which adds a framework at a time, and the file importer,
 * which adds a whole tree. A second copy is a second truth, and the one that
 * drifts is the one nobody was looking at.
 *
 * The tree used to be a strict ladder, one child kind per parent kind. It is
 * not one any more: COMMANDERS stands BESIDE the ladder, admissible under a
 * center, a domain or a section alike. That is why both maps below are plural.
 * They were singular, and the plural is deliberate rather than defensive — a
 * `Record<OrgKind, OrgKind>` cannot express "a domain holds sections AND a
 * commanders framework", so anyone reaching for the old shape would have to
 * silently drop one of the two.
 */

/** The kinds a framework of this kind may be placed under. */
export const PARENT_KINDS: Record<Exclude<OrgKind, "CENTER">, OrgKind[]> = {
  DOMAIN: ["CENTER"],
  SECTION: ["DOMAIN"],
  TEAM: ["SECTION"],
  // beside the ladder: anywhere that HAS subordinate commanders to hold, which
  // is every kind with children — and so never a team
  COMMANDERS: ["CENTER", "DOMAIN", "SECTION"],
};

/** The kinds that may be placed under a framework of this kind. */
export const CHILD_KINDS: Record<OrgKind, OrgKind[]> = {
  CENTER: ["DOMAIN", "COMMANDERS"],
  DOMAIN: ["SECTION", "COMMANDERS"],
  SECTION: ["TEAM", "COMMANDERS"],
  TEAM: [],
  COMMANDERS: [], // a leaf: it holds cards, never frameworks
};

export const KIND_LABEL: Record<OrgKind, string> = {
  CENTER: "מרכז",
  DOMAIN: "תחום",
  SECTION: "מדור",
  TEAM: "צוות",
  COMMANDERS: "מפקדים",
};

/**
 * Roots-first, so a parent always exists before the children that name it.
 *
 * COMMANDERS is LAST and must stay last: its parent may be any of the three
 * ladder kinds above it, so it is the only kind with no fixed depth.
 */
export const KIND_ORDER: OrgKind[] = ["CENTER", "DOMAIN", "SECTION", "TEAM", "COMMANDERS"];

export function isOrgKind(v: string): v is OrgKind {
  return KIND_ORDER.includes(v as OrgKind);
}

/**
 * Which kinds carry people.
 *
 * Stated outright rather than derived from `CHILD_KINDS[kind].length === 0`.
 * "Is a leaf" and "holds people" happen to coincide today, and conflating them
 * would fail silently the first time a leaf kind arrives that holds no cards.
 * The same reasoning that put the nesting rule in one place puts this here:
 * six call sites used to spell it `kind === "TEAM"` for themselves.
 */
export function holdsPeople(kind: OrgKind): boolean {
  return kind === "TEAM" || kind === "COMMANDERS";
}

/** «מרכז, תחום או מדור» — for error messages that name a set of kinds. */
export function kindList(kinds: OrgKind[]): string {
  const labels = kinds.map((k) => KIND_LABEL[k]);
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} או ${labels[labels.length - 1]}`;
}

/**
 * May a framework of `kind` sit under this parent? The reason, or null if it may.
 *
 * Pure, and here rather than in `org-actions`, for two reasons: the add form and
 * the edit form both need it and used to carry the rule twice; and a `"use
 * server"` module can export nothing but actions, so a rule living there cannot
 * be exercised on its own. This one can.
 */
export function parentRefusal(kind: Exclude<OrgKind, "CENTER">, parent: { kind: OrgKind } | null): string | null {
  const allowed = PARENT_KINDS[kind];
  if (parent && allowed.includes(parent.kind)) return null;
  // a team is refused for a REASON, not merely by the table: it has no child
  // frameworks, so there are no subordinate commanders for the framework to hold
  if (kind === "COMMANDERS" && parent?.kind === "TEAM") {
    return `לצוות אין תתי-מסגרות, ולכן אין לו מפקדי-משנה להחזיק. מסגרת ${KIND_LABEL.COMMANDERS} יושבת תחת ${kindList(allowed)}.`;
  }
  if (parent?.kind === "COMMANDERS") {
    return `מסגרת ${KIND_LABEL.COMMANDERS} מחזיקה כרטיסים בלבד — לא ניתן לשים תחתיה מסגרות.`;
  }
  return `מסגרת אב של ${KIND_LABEL[kind]} חייבת להיות ${kindList(allowed)}.`;
}

/** The one wording for a commanders-name collision, so both gates read alike. */
export function commandersClashMessage(name: string, path: string): string {
  return `כבר קיימת מסגרת ${KIND_LABEL.COMMANDERS} בשם ״${name}״${path ? ` תחת ${path}` : ""}. שם מסגרת מפקדים חייב להיות ייחודי בכל המערכת.`;
}

/**
 * How siblings are ordered wherever the tree is drawn.
 *
 * A commanders framework comes FIRST among its siblings — it is a different
 * class of thing from the frameworks beside it, and sorted purely by name it
 * would land somewhere in the middle of the teams, reading as one of them. The
 * mirror of «לא משויכים», which is pinned last for the same kind of reason.
 *
 * One comparator, because three places draw the tree — the dashboard, the
 * scoped tree and the hierarchy screen — and a tree that ordered itself
 * differently on each would look like a bug in whichever one you saw second.
 */
export function bySiblingOrder(a: { kind: OrgKind; name: string }, b: { kind: OrgKind; name: string }): number {
  const rank = (k: OrgKind) => (k === "COMMANDERS" ? 0 : 1);
  return rank(a.kind) - rank(b.kind) || a.name.localeCompare(b.name, "he");
}

/**
 * A framework as it should read on screen, kind and name together.
 *
 * A commanders framework is usually NAMED something starting with «מפקדים», so
 * the plain «kind: name» composition would stutter — «מפקדים: מפקדים מדור 1».
 * Dropping the prefix for every commanders framework would go too far the other
 * way: «סגל פיקודי» genuinely needs its kind said. So the prefix is dropped
 * only where the name already carries it.
 */
export function frameworkLabel(kind: OrgKind, name: string): string {
  const label = KIND_LABEL[kind];
  return name.trimStart().startsWith(label) ? name : `${label}: ${name}`;
}
