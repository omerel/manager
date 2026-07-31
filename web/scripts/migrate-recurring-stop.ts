/**
 * One-off data migration for the recurring-stop-until-month change.
 * Idempotent — safe to re-run, a no-op on a database already migrated.
 *
 *   npx tsx --env-file=.env scripts/migrate-recurring-stop.ts
 *
 * "Until end of service" is gone as an authoring option: the date is unknown
 * for most people, and when it was missing the code silently fell back to a
 * 36-month preview horizon that ended up driving gap computation. Every such
 * event — and any event left without an offset — is pinned to an explicit cap.
 *
 * Person-assigned plan copies are ordinary CareerPlan rows, so this one query
 * covers templates and copies alike.
 */
import { prisma } from "@/lib/prisma";

const DEFAULT_STOP_MONTHS = 72; // realistic service span, chosen with the Admin

async function main() {
  const events = await prisma.recurringEvent.findMany({
    select: { id: true, label: true, stopMode: true, stopOffsetMonths: true },
  });

  let migrated = 0;
  for (const e of events) {
    const needsMode = e.stopMode !== "UNTIL_OFFSET";
    const needsOffset = e.stopOffsetMonths == null;
    if (!needsMode && !needsOffset) continue;
    await prisma.recurringEvent.update({
      where: { id: e.id },
      data: {
        stopMode: "UNTIL_OFFSET",
        stopOffsetMonths: e.stopOffsetMonths ?? DEFAULT_STOP_MONTHS,
      },
    });
    migrated++;
  }
  console.log(`recurring events migrated: ${migrated} of ${events.length}`);

  const leftover = await prisma.recurringEvent.count({
    where: { OR: [{ stopMode: { not: "UNTIL_OFFSET" } }, { stopOffsetMonths: null }] },
  });
  console.log(leftover === 0 ? "✓ every recurring event now has an explicit stop month" : `✗ ${leftover} still unresolved`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
