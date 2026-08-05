import Link from "next/link";
import { parseMentions } from "@/lib/mentions";

/** What the reader is allowed to open: id → current name, for people they can see. */
export type MentionDirectory = Map<string, { name: string; visible: boolean }>;

/**
 * Render text with its person tags as links to those people.
 *
 * Three cases, and each is deliberate:
 *
 *   visible person   → a link, opening in a new tab so the query being read is
 *                      not lost behind it
 *   invisible person → the name as plain text. The person page would answer
 *                      "not found" for this reader, and a link that leads
 *                      nowhere is worse than no link
 *   deleted person   → the label stored at the time of writing, plain. The
 *                      sentence still reads.
 */
export function MentionText({ text, directory }: { text: string; directory: MentionDirectory }) {
  const spans = parseMentions(text);
  return (
    <p className="whitespace-pre-wrap">
      {spans.map((s, i) => {
        if (s.kind === "text") return <span key={i}>{s.text}</span>;
        const known = directory.get(s.personId);
        const name = known?.name ?? s.label;
        if (!known?.visible) {
          return (
            <span key={i} className="rounded bg-slate-100 px-1 text-slate-700" title="אין לך הרשאה לצפות באיש זה">
              @{name}
            </span>
          );
        }
        return (
          <Link
            key={i}
            href={`/people/${s.personId}`}
            target="_blank"
            rel="noopener"
            className="rounded bg-brand-50 px-1 font-medium text-brand-700 hover:underline"
          >
            @{name}
          </Link>
        );
      })}
    </p>
  );
}
