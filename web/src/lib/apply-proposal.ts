import { prisma } from "@/lib/prisma";
import { parseIsraeliDate } from "@/lib/dates";
import { composeFullName } from "@/lib/person-name";
import type { ProposalItem } from "@/lib/proposals";

/**
 * Writes ONE approved proposal item onto a person — the shared engine behind
 * the extraction panel, the intake review and the HR external update. It holds
 * no authorization of its own, deliberately: the "use server" actions that call
 * it (resolveProposalItem and friends) do the authz and session work first.
 * Keep it out of any "use server" file, or it becomes an open endpoint.
 */
export async function applyProposalItem(personId: string, item: ProposalItem & { kind?: "delete" }) {
  // ---- career values from the external update: resolved by LABEL against the
  // person's OWN plan copy; deletion removes exactly the one row
  if (item.key.startsWith("point:")) {
    const label = item.key.slice(6);
    const person = await prisma.person.findUniqueOrThrow({
      where: { id: personId },
      select: { assignedPlan: { select: { pointEvents: { where: { label }, select: { id: true } } } } },
    });
    const event = person.assignedPlan?.pointEvents[0];
    if (!event) throw new Error(`אירוע ״${label}״ אינו בתכנית של אדם זה.`);
    if (item.kind === "delete" || !item.proposed) {
      await prisma.pointProgress.deleteMany({ where: { personId, pointEventId: event.id } });
      return;
    }
    const d = parseIsraeliDate(item.proposed);
    if (!d) throw new Error("תאריך ביצוע לא תקין — נדרש dd/mm/yyyy.");
    await prisma.pointProgress.upsert({
      where: { personId_pointEventId: { personId, pointEventId: event.id } },
      create: { personId, pointEventId: event.id, doneOn: d, note: "עדכון חיצוני (משא״ן)" },
      update: { doneOn: d },
    });
    return;
  }
  if (item.key.startsWith("metric:")) {
    const name = item.key.slice(7);
    const person = await prisma.person.findUniqueOrThrow({
      where: { id: personId },
      select: { assignedPlan: { select: { cumulativeMetrics: { where: { name }, select: { id: true } } } } },
    });
    const metric = person.assignedPlan?.cumulativeMetrics[0];
    if (!metric) throw new Error(`מדד ״${name}״ אינו בתכנית של אדם זה.`);
    if (item.kind === "delete" || !item.proposed) {
      await prisma.metricReading.deleteMany({ where: { personId, metricId: metric.id } });
      return;
    }
    const num = Number(item.proposed);
    if (!Number.isFinite(num)) throw new Error("ערך מדד לא תקין.");
    await prisma.metricReading.upsert({
      where: { personId_metricId: { personId, metricId: metric.id } },
      create: { personId, metricId: metric.id, value: num, asOf: new Date(), note: "עדכון חיצוני (משא״ן)" },
      update: { value: num, asOf: new Date() },
    });
    return;
  }
  // ---- a deletion of a configurable field empties its value
  if (item.kind === "delete" && item.key.startsWith("field:")) {
    await prisma.personFieldValue.deleteMany({ where: { personId, fieldDefId: item.key.slice(6) } });
    return;
  }
  if (item.key === "framework") {
    // the extracted NAME becomes a team only through the shared resolver —
    // in-scope only, namesakes refused — the same rule as the table import
    const { getSessionUser } = await import("@/lib/session");
    const { computeVisibility } = await import("@/lib/access");
    const { resolveTeamByName } = await import("@/lib/hr-import");
    const user = await getSessionUser();
    const visibility = await computeVisibility(user);
    const nodes = await prisma.orgNode.findMany({ select: { id: true, name: true, parentId: true, kind: true } });
    const res = resolveTeamByName(visibility, nodes, item.proposed);
    if (!res.ok) throw new Error(res.reason);
    await prisma.person.update({ where: { id: personId }, data: { teamId: res.teamId } });
  } else if (item.key === "firstName" || item.key === "lastName") {
    const p = await prisma.person.findUniqueOrThrow({ where: { id: personId } });
    const firstName = item.key === "firstName" ? item.proposed : p.firstName;
    const lastName = item.key === "lastName" ? item.proposed : p.lastName;
    await prisma.person.update({
      where: { id: personId },
      data: { firstName, lastName, fullName: composeFullName(firstName, lastName) },
    });
  } else if (item.key === "birthDate" || item.key === "recruitmentDate" || item.key === "placementDate" || item.key === "endOfServiceDate") {
    // the one nullable core date: a deletion proposal clears it
    if (item.key === "endOfServiceDate" && (item.kind === "delete" || !item.proposed)) {
      await prisma.person.update({ where: { id: personId }, data: { endOfServiceDate: null } });
      return;
    }
    // read day-first; a value we cannot parse is refused, never guessed
    const d = parseIsraeliDate(item.proposed);
    if (!d) throw new Error("תאריך מוצע לא תקין — נדרש dd/mm/yyyy.");
    await prisma.person.update({ where: { id: personId }, data: { [item.key]: d } });
  } else if (item.key.startsWith("field:")) {
    const fieldDefId = item.key.slice(6);
    const def = await prisma.personFieldDef.findUnique({ where: { id: fieldDefId } });
    if (!def) throw new Error("שדה לא קיים.");
    await prisma.personFieldValue.upsert({
      where: { personId_fieldDefId: { personId, fieldDefId } },
      create: { personId, fieldDefId, value: item.proposed, order: def.order },
      update: { value: item.proposed },
    });
  }
}
