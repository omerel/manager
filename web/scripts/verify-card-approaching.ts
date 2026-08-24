/**
 * Verification for card-approaching-recurrence — the dashboard's 🟡 for an
 * approaching recurring occurrence is findable on the person card.
 *
 * Needs the dev server on :4321 for the rendered-card checks.
 *
 *   npx tsx scripts/verify-card-approaching.ts
 */
import { prisma } from "@/lib/prisma";
import { computePersonGaps } from "@/lib/gaps";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

const TAG = "caverify";
const BASE = process.env.BASE_URL ?? "http://localhost:4321";

let failures = 0;
let checks = 0;
function check(label: string, ok: boolean, detail = "") {
  checks++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function cleanup() {
  await prisma.person.deleteMany({ where: { fullName: { startsWith: TAG } } });
  await prisma.careerPlan.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.orgNode.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { username: { startsWith: TAG } } });
}

async function main() {
  await cleanup();
  const center = await prisma.orgNode.create({ data: { name: `${TAG} מרכז`, kind: "CENTER" } });
  const domain = await prisma.orgNode.create({ data: { name: `${TAG} תחום`, kind: "DOMAIN", parentId: center.id } });
  const section = await prisma.orgNode.create({ data: { name: `${TAG} מדור`, kind: "SECTION", parentId: domain.id } });
  const team = await prisma.orgNode.create({ data: { name: `${TAG} צוות`, kind: "TEAM", parentId: section.id } });
  const admin = await prisma.user.create({
    data: { name: `${TAG} אדמין`, email: `${TAG}@verify.invalid`, username: `${TAG}-adm`, passwordHash: hashPassword("x"), role: "ADMIN" },
  });

  // placement ~11.3 months ago + a yearly recurring event from month 12 → the
  // month-12 occurrence lands ~3 weeks out: safely inside the 30-day window
  const today = new Date();
  const placement = new Date(today);
  placement.setUTCMonth(placement.getUTCMonth() - 11);
  placement.setUTCDate(placement.getUTCDate() - 10);

  const plan = await prisma.careerPlan.create({
    data: {
      name: `${TAG} מסלול`, isTemplate: false,
      recurringEvents: {
        create: [{ label: `${TAG} הערכה שנתית`, intervalMonths: 12, startOffsetMonths: 12, stopMode: "UNTIL_OFFSET", stopOffsetMonths: 60, display: "MARKER" }],
      },
    },
  });
  const person = await prisma.person.create({
    data: {
      firstName: TAG, lastName: "נבחן", fullName: `${TAG} נבחן`,
      recruitmentDate: placement, placementDate: placement, teamId: team.id, assignedPlanId: plan.id,
    },
  });
  await prisma.planAssignment.create({
    data: { personId: person.id, planId: plan.id, templateName: plan.name, waiverOffsetMonths: 0 },
  });

  try {
    console.log("=== the engine (the dashboard's view) says APPROACHING ===");
    const full = await prisma.person.findUniqueOrThrow({
      where: { id: person.id },
      include: {
        pointProgress: true, metricReadings: true,
        evalEntries: { select: { recurringEventId: true, occurrenceOffset: true } },
        assignedPlan: {
          include: {
            pointEvents: true, cumulativeMetrics: { include: { checkpoints: true } }, recurringEvents: true,
            assignment: { select: { waiverOffsetMonths: true, waivers: true } },
          },
        },
      },
    });
    const gaps = computePersonGaps(full, today);
    check("the person's status is APPROACHING", gaps.status === "APPROACHING", String(gaps.status));
    check("the approaching item is the recurring event",
      gaps.items.some((i) => i.kind === "recurring" && i.level === "APPROACHING"));

    console.log("\n=== the card marks the same occurrence ===");
    const cookie = `${SESSION_COOKIE}=${createSessionToken(admin.id)}`;
    const res = await fetch(`${BASE}/people/${person.id}`, { headers: { cookie } });
    const html = res.status === 200 ? await res.text() : "";
    check("the card answers", res.status === 200, `HTTP ${res.status}`);
    // the header's counts line always carries a 🟡 glyph, so the row is
    // asserted by its own marks: the 🟡…מתקרב pairing and the amber tint
    check("the slot row is marked 🟡 מתקרב", /🟡[^]{0,400}· מתקרב/.test(html.replaceAll("<!-- -->", "")));
    check("and carries the amber row tint", html.includes("border-amber-200 bg-amber-50/50"));

    console.log("\n=== a waived near occurrence shows ⊘, not 🟡 ===");
    const rec = full.assignedPlan!.recurringEvents[0];
    await prisma.planWaiver.create({
      data: {
        assignmentId: (await prisma.planAssignment.findFirstOrThrow({ where: { personId: person.id } })).id,
        recurringEventId: rec.id, occurrenceOffset: 12, waived: true,
      },
    });
    const gaps2 = computePersonGaps(
      await prisma.person.findUniqueOrThrow({
        where: { id: person.id },
        include: {
          pointProgress: true, metricReadings: true,
          evalEntries: { select: { recurringEventId: true, occurrenceOffset: true } },
          assignedPlan: {
            include: {
              pointEvents: true, cumulativeMetrics: { include: { checkpoints: true } }, recurringEvents: true,
              assignment: { select: { waiverOffsetMonths: true, waivers: true } },
            },
          },
        },
      }),
      today,
    );
    check("the engine no longer counts it approaching",
      !gaps2.items.some((i) => i.kind === "recurring" && i.level === "APPROACHING"), JSON.stringify(gaps2.items));
    const res2 = await fetch(`${BASE}/people/${person.id}`, { headers: { cookie } });
    const html2 = (await res2.text()).replaceAll("<!-- -->", "");
    check("and the card marks no row מתקרב either — the two screens agree",
      !html2.includes("· מתקרב") && !html2.includes("border-amber-200 bg-amber-50/50"));
  } finally {
    await cleanup();
    const residue = (await prisma.person.count({ where: { fullName: { startsWith: TAG } } })) +
      (await prisma.orgNode.count({ where: { name: { startsWith: TAG } } })) +
      (await prisma.user.count({ where: { username: { startsWith: TAG } } }));
    check("no fixtures left behind", residue === 0, `${residue}`);
  }

  if (checks === 0) { console.log("\nFAILED — ZERO checks"); process.exitCode = 1; }
  else { console.log(failures ? `\nFAILED — ${checks} ran, ${failures} failed` : `\nall ${checks} checks passed`); process.exitCode = failures ? 1 : 0; }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("\nFAILED — the suite crashed:", e);
  await cleanup().catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
