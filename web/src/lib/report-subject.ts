/**
 * The subject of an emailed report: the report's own first line.
 *
 * Reports already open with the sentence that names them —
 * `# אנשים במרכז המחקר` — which is exactly what a subject line wants. The
 * previous subject was assembled as `<rule name or "תשובה"> · <date>`, so every
 * answer arrived looking identical in an inbox.
 *
 * Defined once because both senders must agree: an answer emailed from the
 * questions page and a rule report emailed on a schedule cannot title
 * themselves by different rules.
 *
 * A known limitation, accepted rather than papered over: this takes the FIRST
 * line, as asked. A report opening with `**נכון לתאריך: 2026-08-02**` therefore
 * gets that as its subject — faithful, and not a good subject. Hunting for a
 * heading further down would fix that case and make the subject unpredictable
 * in others.
 */

/** Longest a subject may be before it is cut on a word boundary. */
const MAX_SUBJECT = 120;

export function subjectFromReport(body: string | null | undefined, fallback: string): string {
  const first = String(body ?? "")
    .split("\n")
    .map((l) => l.trim())
    .find(Boolean);
  if (!first) return fallback;

  const cleaned = first
    .replace(/^#{1,6}\s*/, "") // markdown heading markers
    .replace(/^\s*[-*+]\s+/, "") // a leading list bullet
    .replace(/^\s*>\s*/, "") // a blockquote marker
    .replace(/(\*\*|__|\*|_|`)/g, "") // emphasis and code ticks, anywhere in the line
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return fallback;
  if (cleaned.length <= MAX_SUBJECT) return cleaned;

  // cut on a word boundary rather than mid-word; fall back to a hard cut when
  // the line has no spaces to cut at
  const cut = cleaned.slice(0, MAX_SUBJECT);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > MAX_SUBJECT * 0.6 ? cut.slice(0, lastSpace) : cut).trim() + "…";
}
