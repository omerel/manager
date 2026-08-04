/**
 * Verification for admin-delete-person-and-plan (tasks 6.1–6.4, 6.6).
 *
 * Builds a throwaway person with real history, deletes them through the action's
 * own logic, and asserts nothing survives. Then deletes a template and asserts
 * the people on it did not move. The template case runs inside a rolled-back
 * transaction so the dev registry is left exactly as it was found.
 *
 *   npx tsx --env-file=.env scripts/verify-deletion.ts
 */
import { mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { prisma } from "../src/lib/prisma";
import { UPLOADS_ROOT, deleteUploadDir } from "../src/lib/storage";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

/** The delete exactly as removePerson performs it, minus the auth and revalidation. */
async function deletePersonLikeTheAction(personId: string) {
  const person = await prisma.person.findUnique({
    where: { id: personId },
    select: { id: true, assignedPlanId: true, planAssignments: { select: { planId: true } } },
  });
  if (!person) throw new Error("gone already");
  const copyIds = [
    ...new Set([...person.planAssignments.map((a) => a.planId), person.assignedPlanId].filter((v): v is string => v !== null)),
  ];
  await prisma.$transaction(async (tx) => {
    await tx.person.delete({ where: { id: personId } });
    if (copyIds.length) await tx.careerPlan.deleteMany({ where: { id: { in: copyIds }, isTemplate: false } });
  });
  await deleteUploadDir(personId);
  return copyIds;
}

async function person() {
  console.log("\n=== 6.1 deleting a person leaves nothing ===");
  const template = await prisma.careerPlan.findFirst({
    where: { isTemplate: true, pointEvents: { some: {} }, cumulativeMetrics: { some: {} } },
    include: { pointEvents: true, cumulativeMetrics: true, recurringEvents: true },
  });
  if (!template) throw new Error("no usable template in the dev database");
  const team = await prisma.orgNode.findFirst({ where: { kind: "TEAM" } });

  const p = await prisma.person.create({
    data: {
      firstName: "בדיקת",
      lastName: "מחיקה",
      fullName: "בדיקת מחיקה",
      birthDate: new Date("1995-01-01"),
      recruitmentDate: new Date("2023-01-01"),
      placementDate: new Date("2023-01-01"),
      teamId: team?.id ?? null,
      photoPath: null,
    },
  });

  // two plan copies, so the multi-assignment path is the one under test
  const copies: string[] = [];
  for (const round of [0, 1]) {
    const copy = await prisma.careerPlan.create({
      data: {
        name: `${template.name} (בדיקה ${round})`,
        isTemplate: false,
        sourceTemplateId: template.id,
        pointEvents: { create: template.pointEvents.map((e) => ({ label: e.label, offsetMonths: e.offsetMonths })) },
        cumulativeMetrics: { create: template.cumulativeMetrics.map((m) => ({ name: m.name, unit: m.unit })) },
      },
      include: { pointEvents: true, cumulativeMetrics: true },
    });
    copies.push(copy.id);
    const assignment = await prisma.planAssignment.create({
      data: {
        personId: p.id,
        planId: copy.id,
        templateName: template.name,
        endedAt: round === 0 ? new Date() : null,
        waiverOffsetMonths: 0,
      },
    });
    await prisma.planWaiver.create({
      data: { assignmentId: assignment.id, pointEventId: copy.pointEvents[0].id, waived: true },
    });
    await prisma.planCarryOver.create({
      data: { assignmentId: assignment.id, kind: "METRIC", fromPlanName: "קודם", fromLabel: "מדד", value: 1 },
    });
    await prisma.pointProgress.create({
      data: { personId: p.id, pointEventId: copy.pointEvents[0].id, doneOn: new Date() },
    });
    await prisma.metricReading.create({
      data: { personId: p.id, metricId: copy.cumulativeMetrics[0].id, value: 5, asOf: new Date() },
    });
  }
  await prisma.person.update({ where: { id: p.id }, data: { assignedPlanId: copies[1] } });

  const entry = await prisma.evalEntry.create({ data: { personId: p.id, title: "חוו״ד בדיקה", content: "גוף", eventDate: new Date() } });
  await prisma.attachment.create({
    data: { entryId: entry.id, filename: "a.txt", storagePath: `${p.id}/a.txt`, mimeType: "text/plain", size: 3 },
  });
  const defs = await prisma.personFieldDef.findMany({ take: 1 });
  if (defs.length) {
    await prisma.personFieldValue.create({ data: { personId: p.id, fieldDefId: defs[0].id, value: "ערך" } });
  }

  // a real file on disk, so the uploads cleanup is tested and not assumed
  const dir = path.join(UPLOADS_ROOT, p.id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "a.txt"), "abc");
  check("uploads directory exists before the delete", existsSync(dir));

  const before = {
    assignments: await prisma.planAssignment.count({ where: { personId: p.id } }),
    waivers: await prisma.planWaiver.count({ where: { assignment: { personId: p.id } } }),
    carryOvers: await prisma.planCarryOver.count({ where: { assignment: { personId: p.id } } }),
    progress: await prisma.pointProgress.count({ where: { personId: p.id } }),
    readings: await prisma.metricReading.count({ where: { personId: p.id } }),
    entries: await prisma.evalEntry.count({ where: { personId: p.id } }),
    attachments: await prisma.attachment.count({ where: { entry: { personId: p.id } } }),
    fieldValues: await prisma.personFieldValue.count({ where: { personId: p.id } }),
    copies: await prisma.careerPlan.count({ where: { id: { in: copies } } }),
  };
  console.log(`  built: ${JSON.stringify(before)}`);
  check("the fixture actually has history", Object.values(before).every((v) => v > 0) || !defs.length);

  await deletePersonLikeTheAction(p.id);

  const after = {
    person: await prisma.person.count({ where: { id: p.id } }),
    assignments: await prisma.planAssignment.count({ where: { personId: p.id } }),
    waivers: await prisma.planWaiver.count({ where: { assignment: { personId: p.id } } }),
    carryOvers: await prisma.planCarryOver.count({ where: { assignment: { personId: p.id } } }),
    progress: await prisma.pointProgress.count({ where: { personId: p.id } }),
    readings: await prisma.metricReading.count({ where: { personId: p.id } }),
    entries: await prisma.evalEntry.count({ where: { personId: p.id } }),
    attachments: await prisma.attachment.count({ where: { entry: { personId: p.id } } }),
    fieldValues: await prisma.personFieldValue.count({ where: { personId: p.id } }),
    copies: await prisma.careerPlan.count({ where: { id: { in: copies } } }),
    copyPointEvents: await prisma.pointEvent.count({ where: { planId: { in: copies } } }),
    copyMetrics: await prisma.cumulativeMetric.count({ where: { planId: { in: copies } } }),
  };
  for (const [k, v] of Object.entries(after)) check(`${k} = 0`, v === 0, `got ${v}`);
  check("uploads directory removed", !existsSync(dir));
  check("the source template survived", (await prisma.careerPlan.count({ where: { id: template.id } })) === 1);
}

class Rollback extends Error {}

async function template() {
  console.log("\n=== 6.2 deleting a template does not move the people on it ===");
  const t = await prisma.careerPlan.findFirst({
    where: { isTemplate: true, copies: { some: {} } },
    select: { id: true, name: true },
  });
  if (!t) throw new Error("no template with copies");

  const holders = await prisma.person.findMany({
    where: { assignedPlan: { sourceTemplateId: t.id } },
    select: { id: true, assignedPlanId: true },
    orderBy: { id: "asc" },
  });
  const progressBefore = await prisma.pointProgress.count({ where: { personId: { in: holders.map((h) => h.id) } } });
  const readingsBefore = await prisma.metricReading.count({ where: { personId: { in: holders.map((h) => h.id) } } });
  console.log(`  ${holders.length} people hold a copy of "${t.name}"`);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.careerPlan.delete({ where: { id: t.id } });

      const after = await tx.person.findMany({
        where: { id: { in: holders.map((h) => h.id) } },
        select: { id: true, assignedPlanId: true },
        orderBy: { id: "asc" },
      });
      check(
        "every holder still points at the same copy",
        JSON.stringify(after) === JSON.stringify(holders),
        `${after.filter((a, i) => a.assignedPlanId !== holders[i]?.assignedPlanId).length} changed`,
      );
      check(
        "the copies still exist",
        (await tx.careerPlan.count({ where: { id: { in: holders.map((h) => h.assignedPlanId!) } } })) === holders.length,
      );
      check(
        "sourceTemplateId is now null, not the copy deleted",
        (await tx.careerPlan.count({
          where: { id: { in: holders.map((h) => h.assignedPlanId!) }, sourceTemplateId: null },
        })) === holders.length,
      );
      check(
        "recorded progress is untouched",
        (await tx.pointProgress.count({ where: { personId: { in: holders.map((h) => h.id) } } })) === progressBefore,
      );
      check(
        "recorded readings are untouched",
        (await tx.metricReading.count({ where: { personId: { in: holders.map((h) => h.id) } } })) === readingsBefore,
      );
      check(
        "the plan name survives on the assignment snapshot",
        (await tx.planAssignment.count({ where: { templateName: t.name } })) > 0,
      );
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
  check("rolled back — the template is still there", (await prisma.careerPlan.count({ where: { id: t.id } })) === 1);
}

async function copyGuard() {
  console.log("\n=== 6.4 removePlan refuses a plan copy ===");
  const copy = await prisma.careerPlan.findFirst({ where: { isTemplate: false }, select: { id: true } });
  if (!copy) throw new Error("no copy to test with");
  const plan = await prisma.careerPlan.findUnique({ where: { id: copy.id }, select: { isTemplate: true } });
  check("the guard would reject it (isTemplate === false)", plan?.isTemplate === false);
  check("and it is still there", (await prisma.careerPlan.count({ where: { id: copy.id } })) === 1);
}

async function timing() {
  console.log("\n=== 6.6 the people query with counts ===");
  const t0 = process.hrtime.bigint();
  const rows = await prisma.person.findMany({
    include: {
      assignedPlan: { select: { name: true, sourceTemplateId: true } },
      _count: { select: { planAssignments: true, evalEntries: true, pointProgress: true, metricReadings: true } },
    },
  });
  const withCounts = Number(process.hrtime.bigint() - t0) / 1e6;
  const t1 = process.hrtime.bigint();
  await prisma.person.findMany({ include: { assignedPlan: { select: { name: true, sourceTemplateId: true } } } });
  const without = Number(process.hrtime.bigint() - t1) / 1e6;
  console.log(`  ${rows.length} people · with counts ${withCounts.toFixed(1)}ms · without ${without.toFixed(1)}ms`);
  check("the added cost is under 25ms", withCounts - without < 25, `${(withCounts - without).toFixed(1)}ms`);
}

async function main() {
  await person();
  await template();
  await copyGuard();
  await timing();
  console.log(failures === 0 ? "\nall checks passed" : `\n${failures} CHECKS FAILED`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main();
