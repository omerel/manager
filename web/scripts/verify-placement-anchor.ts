/**
 * Verification for placement-anchor-and-recurring-display (tasks 6.2, 6.3).
 *
 * The backfill makes placementDate == recruitmentDate for everyone, so a
 * snapshot diff proves only that nothing broke — it cannot prove the anchor
 * moved, because both fields hold the same value. This does: it shifts one
 * person's placement date and asserts every derived date moves with it, in
 * every consumer, and that a person whose dates are equal does not budge.
 *
 * The subject's placement date is really written and then restored in a
 * finally: getPersonFull and buildAssignmentPreview use the global client, so a
 * rolled-back transaction would be invisible to them and every check would pass
 * vacuously by reading the unchanged state.
 *
 *   npx tsx --env-file=.env scripts/verify-placement-anchor.ts
 */
import { prisma } from "../src/lib/prisma";
import { addMonths, monthsBetween } from "../src/lib/dates";
import { monthsSince } from "../src/lib/waivers";

let failures = 0;
let checks = 0;
function check(label: string, ok: boolean, detail = "") {
  checks++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

const SHIFT = 3; // months
const TAG = "anchorverify";

async function cleanup() {
  await prisma.person.deleteMany({ where: { fullName: { startsWith: TAG } } });
  await prisma.careerPlan.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.orgNode.deleteMany({ where: { name: { startsWith: TAG } } });
}

/**
 * The subject the strong claim must hold for, and a control that must not move.
 *
 * Built rather than found, and the conditions the old `findFirstOrThrow` asked
 * for are now GUARANTEED rather than hoped for:
 *   · plan items to move at all;
 *   · NO end-of-service date — occurrences clip at it, and a clipped list
 *     breaks the index-paired comparison for a reason about the fixture rather
 *     than about the anchor;
 *   · no waiver overrides, which would hide items from the timeline;
 *   · placement == recruitment at the start, which is what makes the shift
 *     observable at all.
 */
async function makeSubjects() {
  const center = await prisma.orgNode.create({ data: { name: `${TAG} מרכז`, kind: "CENTER" } });
  const domain = await prisma.orgNode.create({ data: { name: `${TAG} תחום`, kind: "DOMAIN", parentId: center.id } });
  const section = await prisma.orgNode.create({ data: { name: `${TAG} מדור`, kind: "SECTION", parentId: domain.id } });
  const team = await prisma.orgNode.create({ data: { name: `${TAG} צוות`, kind: "TEAM", parentId: section.id } });
  const start = new Date("2022-01-01T00:00:00Z");

  const mk = async (last: string) => {
    const plan = await prisma.careerPlan.create({
      data: {
        name: `${TAG} מסלול ${last}`, isTemplate: false,
        pointEvents: { create: [{ label: `${TAG} נקודתי`, offsetMonths: 12 }, { label: `${TAG} נקודתי ב`, offsetMonths: 30 }] },
        cumulativeMetrics: {
          create: [{ name: `${TAG} מדד`, unit: "שעות", checkpoints: { create: [{ offsetMonths: 18, target: 40 }] } }],
        },
        recurringEvents: {
          create: [{ label: `${TAG} מחזורי`, intervalMonths: 6, startOffsetMonths: 6, stopMode: "UNTIL_OFFSET", stopOffsetMonths: 36 }],
        },
      },
    });
    const person = await prisma.person.create({
      data: {
        firstName: TAG, lastName: last, fullName: `${TAG} ${last}`,
        recruitmentDate: start, placementDate: start, // equal, deliberately
        endOfServiceDate: null, teamId: team.id, assignedPlanId: plan.id,
      },
      select: { id: true, fullName: true, recruitmentDate: true, placementDate: true },
    });
    // no waivers on the assignment — the timeline must show every item
    await prisma.planAssignment.create({
      data: { personId: person.id, planId: plan.id, templateName: plan.name, assignedAt: start, waiverOffsetMonths: 0 },
    });
    return person;
  };

  return { subject: await mk("נבדק"), control: await mk("בקרה") };
}

async function main() {
  const { getPersonFull, buildPersonTimeline } = await import("../src/lib/person-view");
  const { computePersonGaps } = await import("../src/lib/gaps");
  const TODAY = new Date("2026-08-03T00:00:00Z");

  // A subject the strong claim is meant to hold for, picked deterministically so
  // regenerating the demo data cannot silently hand over a different one:
  //   · plan items to move at all;
  //   · NO end-of-service date — occurrences clip at it, and a clipped list
  //     breaks the index-paired comparison below for a reason that is about the
  //     fixture, not about the anchor;
  //   · no waiver overrides, which would hide items from the timeline.
  // BUILT, not found. The conditions above describe a person the suite needs
  // two of, and the database is not obliged to contain them: this used to
  // crash on `findFirstOrThrow` the moment the demo data held fewer than two
  // people with a career plan — which is the state it is in now. A suite that
  // cannot state its own premise cannot report on anything.
  await cleanup(); // a run killed halfway must not poison the next one
  const { subject, control } = await makeSubjects();

  const dates = (t: Awaited<ReturnType<typeof buildPersonTimeline>>) => [
    ...t.points.map((p) => `P:${p.label}@${p.dueDate.toISOString()}`),
    ...t.metrics.flatMap((m) => m.checkpoints.map((c) => `M:${m.name}@${c.dueDate.toISOString()}`)),
    ...t.recurrences.map((r) => `R:${r.label}:${r.offsetMonths}@${r.dueDate.toISOString()}`),
  ];

  const beforeSubject = dates(buildPersonTimeline((await getPersonFull(subject.id))!));
  const beforeControl = dates(buildPersonTimeline((await getPersonFull(control.id))!));
  const beforeGaps = computePersonGaps((await getPersonFull(subject.id))! as never, TODAY)
    .items.map((i) => `${i.label}@${i.dueDate.toISOString()}:${i.level}`);

  console.log(`\n=== 6.2 the anchor moves with the placement date ===`);
  console.log(`  subject: ${subject.fullName} (${beforeSubject.length} dated items)`);
  check("the subject's plan has dated items to move", beforeSubject.length > 0);
  check("subject starts with placement == recruitment",
    subject.placementDate.getTime() === subject.recruitmentDate.getTime());

  try {
    await prisma.person.update({
      where: { id: subject.id },
      data: { placementDate: addMonths(subject.recruitmentDate, SHIFT) },
    });
    {
      const afterSubject = dates(buildPersonTimeline((await getPersonFull(subject.id))!));
      const afterControl = dates(buildPersonTimeline((await getPersonFull(control.id))!));
      const afterGaps = computePersonGaps((await getPersonFull(subject.id))! as never, TODAY)
        .items.map((i) => `${i.label}@${i.dueDate.toISOString()}:${i.level}`);

      // every due date must have moved by exactly SHIFT months
      const shifted = beforeSubject.every((b, i) => {
        const [prefix, iso] = [b.slice(0, b.lastIndexOf("@")), b.slice(b.lastIndexOf("@") + 1)];
        const a = afterSubject[i];
        if (!a || !a.startsWith(prefix + "@")) return false;
        return monthsBetween(new Date(iso), new Date(a.slice(a.lastIndexOf("@") + 1))) === SHIFT;
      });
      check(`every one of the subject's ${beforeSubject.length} dates moved by exactly ${SHIFT} months`, shifted);
      check("the subject's dates did change at all", JSON.stringify(beforeSubject) !== JSON.stringify(afterSubject));
      check("the gap engine's due dates moved too", JSON.stringify(beforeGaps) !== JSON.stringify(afterGaps));
      check("a person whose dates are equal is untouched", JSON.stringify(beforeControl) === JSON.stringify(afterControl));

      // the assignment preview reads the same anchor
      const { buildAssignmentPreview } = await import("../src/lib/plan-assignment");
      const tpl = await prisma.careerPlan.findFirstOrThrow({ where: { isTemplate: true }, select: { id: true } });
      const preview = await buildAssignmentPreview(subject.id, tpl.id, TODAY);
      const expectedLine = monthsSince(addMonths(subject.recruitmentDate, SHIFT), TODAY);
      check("the assignment preview's waiver line is measured from placement",
        preview?.tenureMonths === expectedLine, `${preview?.tenureMonths} vs ${expectedLine}`);
    }
  } finally {
    await prisma.person.update({ where: { id: subject.id }, data: { placementDate: subject.placementDate } });
  }

  const restored = await prisma.person.findUniqueOrThrow({
    where: { id: subject.id },
    select: { placementDate: true, recruitmentDate: true },
  });
  check("rolled back — the subject's placement date is unchanged",
    restored.placementDate.getTime() === restored.recruitmentDate.getTime());

  console.log(`\n=== 6.3 the stored waiver line follows the placement date ===`);
  try {
    {
      // recruited long ago, placed here recently → almost nothing should be waived
      await prisma.person.update({
        where: { id: subject.id },
        data: { placementDate: addMonths(new Date("2026-08-03T00:00:00Z"), -2) },
      });
      const p = await prisma.person.findUniqueOrThrow({ where: { id: subject.id }, select: { placementDate: true, recruitmentDate: true } });
      const fromPlacement = monthsSince(p.placementDate, TODAY);
      const fromRecruitment = monthsSince(p.recruitmentDate, TODAY);
      // Precondition, asserted rather than assumed: the comparison below only
      // means anything if recruitment is genuinely EARLIER than the synthetic
      // placement, and the plan has items in the band between them. Otherwise a
      // reshuffled fixture fails as though the anchor were broken.
      check("fixture is suitable: recruitment precedes the synthetic placement",
        fromRecruitment > fromPlacement, `placement ${fromPlacement} vs recruitment ${fromRecruitment}`);

      const { buildAssignmentPreview } = await import("../src/lib/plan-assignment");
      const tpl = await prisma.careerPlan.findFirstOrThrow({ where: { isTemplate: true }, select: { id: true } });
      const preview = await buildAssignmentPreview(subject.id, tpl.id, TODAY);
      check("the preview's line equals months since PLACEMENT", preview?.tenureMonths === fromPlacement,
        `${preview?.tenureMonths}`);
      check("and is NOT months since recruitment", preview?.tenureMonths !== fromRecruitment);
      // The meaningful assertion is not "zero waived" — an item at month ≤ 2 IS
      // correctly waived by a 2-month line. It is that FAR FEWER are waived than
      // the old axis would have waived, which is the whole point of the move.
      const waivedNow = preview?.items.filter((i) => i.waivedByDefault).length ?? 0;
      const waivedOnOldAxis = preview?.items.filter((i) => i.offsetMonths <= fromRecruitment).length ?? 0;
      check("fixture is suitable: the plan has items between the two axes",
        waivedOnOldAxis > 0, `${waivedOnOldAxis} items at or before month ${fromRecruitment}`);
      check("far fewer items are waived than on the recruitment axis",
        waivedNow < waivedOnOldAxis, `${waivedNow} waived now vs ${waivedOnOldAxis} on the old axis`);
      check("every still-waived item genuinely predates the placement line",
        (preview?.items ?? []).filter((i) => i.waivedByDefault).every((i) => i.offsetMonths <= fromPlacement));
    }
  } finally {
    await prisma.person.update({ where: { id: subject.id }, data: { placementDate: subject.placementDate } });
  }

  const finalState = await prisma.person.findUniqueOrThrow({ where: { id: subject.id }, select: { placementDate: true, recruitmentDate: true } });
  check("restored — the registry is exactly as found",
    finalState.placementDate.getTime() === finalState.recruitmentDate.getTime());

  await cleanup();
  const residue =
    (await prisma.person.count({ where: { fullName: { startsWith: TAG } } })) +
    (await prisma.careerPlan.count({ where: { name: { startsWith: TAG } } })) +
    (await prisma.orgNode.count({ where: { name: { startsWith: TAG } } }));
  check("no fixtures left behind", residue === 0, `${residue}`);

  console.log(failures === 0 ? `\nall ${checks} checks passed` : `\nFAILED — ${checks} ran, ${failures} failed`);
  await prisma.$disconnect();
  process.exit(failures ? 1 : 0);
}

main();
