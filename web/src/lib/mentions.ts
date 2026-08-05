/**
 * Tagging a person inside a query or an answer.
 *
 * Queries are almost always about people, so the text needs to point at them —
 * not merely name them. The token that does it:
 *
 *     @[דנה כהן](cmsf6i3vf00026pzur2lpi31a)
 *          ↑              ↑
 *      label at the    the person's id — the actual reference
 *      time of writing
 *
 * The ID is the truth and the label is a convenience. Rendering re-resolves the
 * name from the database, so a person who is renamed after being tagged appears
 * under their current name rather than a stale one; the stored label is the
 * fallback for a person who no longer exists, which is the one case where the
 * old text is better than nothing.
 *
 * Storing the tag inline rather than in a join table keeps the sentence intact
 * — a mention has a POSITION in a sentence, and a side table would have to
 * reinvent it.
 */

/** `@[label](id)` — ids are cuids, so the character class is deliberately narrow. */
const MENTION = /@\[([^\]\n]{1,80})\]\(([A-Za-z0-9_-]{1,40})\)/g;

export type MentionSpan =
  | { kind: "text"; text: string }
  | { kind: "mention"; personId: string; label: string };

/** Split text into plain runs and mentions, in order. */
export function parseMentions(text: string): MentionSpan[] {
  const out: MentionSpan[] = [];
  let last = 0;
  for (const m of String(text ?? "").matchAll(MENTION)) {
    const start = m.index ?? 0;
    if (start > last) out.push({ kind: "text", text: text.slice(last, start) });
    out.push({ kind: "mention", personId: m[2], label: m[1] });
    last = start + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

/** Every person id referenced, for a single lookup rather than one per mention. */
export function mentionedIds(...texts: (string | null | undefined)[]): string[] {
  const ids = new Set<string>();
  for (const t of texts) {
    for (const m of String(t ?? "").matchAll(MENTION)) ids.add(m[2]);
  }
  return [...ids];
}

/**
 * The same text with tags flattened to plain `@name`.
 *
 * For anywhere the markup would be read rather than rendered — above all the
 * notification email, where `@[דנה כהן](cmsf…)` would arrive as exactly that.
 */
export function stripMentions(text: string | null | undefined): string {
  return String(text ?? "").replace(MENTION, (_all, label: string) => `@${label}`);
}

/** Build the token the editor inserts. Newlines and brackets in a name would break the form. */
export function mentionToken(personId: string, name: string): string {
  return `@[${name.replace(/[\[\]\n]/g, " ").trim()}](${personId})`;
}
