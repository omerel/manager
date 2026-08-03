import { prisma } from "@/lib/prisma";
import { parseIsraeliDate } from "@/lib/dates";

export type ProposalItem = {
  key: string; // "firstName" | "lastName" | "birthDate" | "recruitmentDate" | "endOfServiceDate" | "field:<fieldDefId>"
  label: string;
  current: string;
  proposed: string;
};

type ExtractedField = { key: string; label: string; type?: string };

/**
 * Turn raw agent extractions into field proposals on an existing person —
 * merged against their current values so only real differences are proposed,
 * and any previous open proposal is replaced. One implementation, used by the
 * single-document update flow and by bulk intake: the merge rule is the
 * product ("the agent proposes, a human approves the difference"), and two
 * copies of it would drift.
 */
export async function proposeFieldUpdates(
  userId: string,
  personId: string,
  raw: { key: string; proposed: string }[],
  fields: ExtractedField[],
): Promise<ProposalItem[]> {
  const person = await prisma.person.findUniqueOrThrow({
    where: { id: personId },
    include: { fieldValues: { include: { field: true } } },
  });
  const valueByDef = new Map(person.fieldValues.map((fv) => [fv.fieldDefId, fv.value]));
  const currentOf = (key: string): string => {
    if (key === "firstName") return person.firstName;
    if (key === "lastName") return person.lastName;
    if (key === "birthDate") return person.birthDate?.toISOString().slice(0, 10) ?? "";
    if (key === "recruitmentDate") return person.recruitmentDate.toISOString().slice(0, 10);
    if (key === "placementDate") return person.placementDate.toISOString().slice(0, 10);
    if (key === "endOfServiceDate") return person.endOfServiceDate?.toISOString().slice(0, 10) ?? "";
    if (key.startsWith("field:")) return valueByDef.get(key.slice(6)) ?? "";
    return "";
  };
  const labelOf = new Map(fields.map((f) => [f.key, f.label]));
  const typeOf = new Map(fields.map((f) => [f.key, f.type]));
  const isDate = (key: string) =>
    typeOf.get(key) === "תאריך" || ["birthDate", "recruitmentDate", "placementDate", "endOfServiceDate"].includes(key);

  const items: ProposalItem[] = raw
    .filter((r) => labelOf.has(r.key))
    // A date the strict reader refuses never reaches the review screen. The
    // reviewer then sees the field missing and types it — which is honest,
    // whereas a guessed date would arrive looking found on a screen built to be
    // approved quickly.
    .filter((r) => !isDate(r.key) || parseIsraeliDate(r.proposed) !== null)
    // normalise what did parse, so the reviewer compares like with like
    .map((r) => ({
      key: r.key,
      label: labelOf.get(r.key)!,
      current: currentOf(r.key),
      proposed: isDate(r.key) ? parseIsraeliDate(r.proposed)!.toISOString().slice(0, 10) : r.proposed,
    }))
    .filter((it) => it.proposed !== it.current);

  // one open proposal per person — replace any previous one
  await prisma.extractionProposal.deleteMany({ where: { personId } });
  if (items.length > 0) {
    await prisma.extractionProposal.create({ data: { personId, createdBy: userId, items } });
  }
  return items;
}
