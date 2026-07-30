/**
 * Soft palette for per-event colors: muted, readable backgrounds with a matching
 * accent for icons/strokes. Assigned once at creation and stored, so a color
 * never shifts when a sibling event is added or removed.
 */
export type SoftColor = { key: string; bg: string; accent: string; border: string };

export const SOFT_PALETTE: SoftColor[] = [
  { key: "teal", bg: "#ecfdf5", accent: "#0d9488", border: "#99f6e4" },
  { key: "sky", bg: "#eff6ff", accent: "#2563eb", border: "#bfdbfe" },
  { key: "amber", bg: "#fffbeb", accent: "#d97706", border: "#fde68a" },
  { key: "violet", bg: "#f5f3ff", accent: "#7c3aed", border: "#ddd6fe" },
  { key: "rose", bg: "#fff1f2", accent: "#e11d48", border: "#fecdd3" },
  { key: "lime", bg: "#f7fee7", accent: "#65a30d", border: "#d9f99d" },
  { key: "cyan", bg: "#ecfeff", accent: "#0891b2", border: "#a5f3fc" },
  { key: "orange", bg: "#fff7ed", accent: "#ea580c", border: "#fed7aa" },
];

/** Pick the next palette color for a plan, cycling by how many already exist. */
export function nextColorKey(existingCount: number): string {
  return SOFT_PALETTE[existingCount % SOFT_PALETTE.length].key;
}

/** Resolve a stored key to its colors (falls back to the first entry). */
export function softColor(key: string | null | undefined): SoftColor {
  return SOFT_PALETTE.find((c) => c.key === key) ?? SOFT_PALETTE[0];
}

/**
 * Same, but rows predating stored colors (key null) fall back to their position
 * in the list, so they still differ from one another.
 */
export function softColorFor(key: string | null | undefined, index: number): SoftColor {
  return SOFT_PALETTE.find((c) => c.key === key) ?? SOFT_PALETTE[index % SOFT_PALETTE.length];
}
