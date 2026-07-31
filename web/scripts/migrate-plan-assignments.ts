/**
 * One-off data migration for the plan-transfer-with-history change.
 * Idempotent — safe to re-run, a no-op once every assigned person has a record.
 *
 *   npx tsx --env-file=.env scripts/migrate-plan-assignments.ts
 *
 * Every person currently on a plan gets the assignment record that the new
 * model expects. Two deliberate choices:
 *
 *  - `assignedAt` is the person's recruitment date. No better information
 *    exists — nothing recorded when the plan was actually given — and it is the
 *    earliest defensible value.
 *  - `waiverOffsetMonths` is 0, NOT the new default. Applying the new rule
 *    retroactively would silently forgive real, currently-reported gaps across
 *    the whole population. Existing assignments keep measuring exactly what
 *    they measure today.
 */
import { prisma } from "@/lib/prisma";

async function main() {
  const people = await prisma.person.findMany({
    where: { assignedPlanId: { not: null } },
    select: {
      id: true,
      fullName: true,
      recruitmentDate: true,
      assignedPlanId: true,
      assignedPlan: { select: { name: true } },
    },
  });

  let created = 0;
  for (const p of people) {
    const already = await prisma.planAssignment.findUnique({ where: { planId: p.assignedPlanId! } });
    if (already) continue;
    await prisma.planAssignment.create({
      data: {
        personId: p.id,
        planId: p.assignedPlanId!,
        templateName: p.assignedPlan?.name ?? "—",
        assignedAt: p.recruitmentDate,
        endedAt: null,
        waiverOffsetMonths: 0, // see the note above
      },
    });
    created++;
  }
  console.log(`assignment records created: ${created} of ${people.length} people with a plan`);

  const missing = await prisma.person.count({
    where: { assignedPlanId: { not: null }, planAssignments: { none: { endedAt: null } } },
  });
  console.log(missing === 0 ? "✓ every assigned person has an active assignment record" : `✗ ${missing} still missing`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
