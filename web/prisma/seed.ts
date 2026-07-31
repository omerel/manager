import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, OrgKind, Role, AccessLevel, EmploymentStatus } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/password";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/** Months before "now" that a recruitment date should sit, as a fixed date (no Date.now noise in output). */
function recruited(year: number, month: number, day = 1): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

async function main() {
  // Clean slate (skeleton dev seed). Deleting a plan cascades to its events.
  await prisma.person.deleteMany();
  await prisma.accessGrant.deleteMany();
  await prisma.user.deleteMany();
  await prisma.orgNode.deleteMany();
  await prisma.careerPlan.deleteMany();
  await prisma.personFieldDef.deleteMany();

  // --- Person-card schema (extra fields beyond the core ones) ---
  await prisma.personFieldDef.createMany({
    data: [
      { key: "f1_tz", label: "תעודת זהות", type: "TEXT", required: false, order: 0 },
      { key: "f2_education", label: "השכלה", type: "TEXT", required: false, order: 1 },
      { key: "f3_specialty", label: "התמחות", type: "ENUM", required: false, options: ["ראייה ממוחשבת", "NLP", "רובוטיקה"], order: 2 },
    ],
  });

  // --- Sample career plan (template, relative to recruitment) ---
  const plan = await prisma.careerPlan.create({
    data: {
      name: "מסלול חוקר",
      pointEvents: {
        create: [
          { label: "סיום הכשרה בסיסית", offsetMonths: 1 },
          { label: "מעבר לתפקיד שני", offsetMonths: 4 },
          { label: "קבלת מענק", offsetMonths: 9 },
        ],
      },
      cumulativeMetrics: {
        create: [
          {
            name: "שעות גמול השתלמות",
            unit: "שעות",
            checkpoints: {
              create: [
                { offsetMonths: 6, target: 100 },
                { offsetMonths: 12, target: 300 },
                { offsetMonths: 18, target: 500 },
              ],
            },
          },
        ],
      },
      recurringEvents: {
        create: [{ label: "חוות דעת", intervalMonths: 6, stopMode: "UNTIL_OFFSET", stopOffsetMonths: 72 }],
      },
    },
  });

  // --- Org tree: center > domain > section > team ---
  const center = await prisma.orgNode.create({ data: { name: "מרכז המחקר", kind: OrgKind.CENTER } });

  const research = await prisma.orgNode.create({
    data: { name: "תחום מחקר", kind: OrgKind.DOMAIN, parentId: center.id },
  });
  const dev = await prisma.orgNode.create({
    data: { name: "תחום פיתוח", kind: OrgKind.DOMAIN, parentId: center.id },
  });

  const visionSection = await prisma.orgNode.create({
    data: { name: "מדור ראייה ממוחשבת", kind: OrgKind.SECTION, parentId: research.id },
  });
  const platformSection = await prisma.orgNode.create({
    data: { name: "מדור פלטפורמה", kind: OrgKind.SECTION, parentId: dev.id },
  });

  const teamAlpha = await prisma.orgNode.create({
    data: { name: "צוות אלפא", kind: OrgKind.TEAM, parentId: visionSection.id },
  });
  const teamBeta = await prisma.orgNode.create({
    data: { name: "צוות בטא", kind: OrgKind.TEAM, parentId: visionSection.id },
  });
  const teamGamma = await prisma.orgNode.create({
    data: { name: "צוות גמא", kind: OrgKind.TEAM, parentId: platformSection.id },
  });

  // --- People (leaves under teams) ---
  // firstName/lastName are the source of truth; fullName is kept in step with
  // them, as the application does on every write.
  const people: {
    firstName: string;
    lastName: string;
    birthDate: Date;
    teamId: string;
    recruitmentDate: Date;
    status?: EmploymentStatus;
  }[] = [
    { firstName: "דנה", lastName: "כהן", birthDate: recruited(1996, 4, 12), teamId: teamAlpha.id, recruitmentDate: recruited(2026, 3) },
    { firstName: "יוסי", lastName: "לוי", birthDate: recruited(1993, 11, 3), teamId: teamAlpha.id, recruitmentDate: recruited(2025, 11) },
    { firstName: "מאיה", lastName: "בר", birthDate: recruited(1998, 1, 27), teamId: teamBeta.id, recruitmentDate: recruited(2024, 9) },
    { firstName: "אורי", lastName: "שמש", birthDate: recruited(1991, 7, 8), teamId: teamBeta.id, recruitmentDate: recruited(2026, 1) },
    { firstName: "נועה", lastName: "גל", birthDate: recruited(1989, 2, 19), teamId: teamBeta.id, recruitmentDate: recruited(2023, 6), status: EmploymentStatus.PLANNED_END },
    { firstName: "איתי", lastName: "רון", birthDate: recruited(1995, 9, 30), teamId: teamGamma.id, recruitmentDate: recruited(2025, 4) },
  ];
  const idByName: Record<string, string> = {};
  for (const p of people) {
    const fullName = `${p.firstName} ${p.lastName}`;
    const created = await prisma.person.create({
      data: { ...p, fullName, status: p.status ?? EmploymentStatus.ACTIVE },
    });
    idByName[fullName] = created.id;
  }

  // Assign an independent copy of the template to a person.
  const tpl = await prisma.careerPlan.findUniqueOrThrow({
    where: { id: plan.id },
    include: { pointEvents: true, recurringEvents: true, cumulativeMetrics: { include: { checkpoints: true } } },
  });
  async function assignCopy(personId: string) {
    const copy = await prisma.careerPlan.create({
      data: {
        name: tpl.name,
        isTemplate: false,
        sourceTemplateId: tpl.id,
        pointEvents: { create: tpl.pointEvents.map((e) => ({ label: e.label, offsetMonths: e.offsetMonths })) },
        recurringEvents: {
          create: tpl.recurringEvents.map((r) => ({
            label: r.label,
            intervalMonths: r.intervalMonths,
            stopMode: r.stopMode,
            stopOffsetMonths: r.stopOffsetMonths,
          })),
        },
        cumulativeMetrics: {
          create: tpl.cumulativeMetrics.map((m) => ({
            name: m.name,
            unit: m.unit,
            checkpoints: { create: m.checkpoints.map((c) => ({ offsetMonths: c.offsetMonths, target: c.target })) },
          })),
        },
      },
      include: { pointEvents: true, cumulativeMetrics: true, recurringEvents: true },
    });
    await prisma.person.update({ where: { id: personId }, data: { assignedPlanId: copy.id } });
    return copy;
  }

  // דנה: assigned with some progress recorded.
  const danaCopy = await assignCopy(idByName["דנה כהן"]);
  const basicTraining = danaCopy.pointEvents.find((e) => e.label === "סיום הכשרה בסיסית");
  if (basicTraining) {
    await prisma.pointProgress.create({
      data: { personId: idByName["דנה כהן"], pointEventId: basicTraining.id, doneOn: recruited(2026, 4, 10) },
    });
  }
  const grantHours = danaCopy.cumulativeMetrics.find((m) => m.name === "שעות גמול השתלמות");
  if (grantHours) {
    await prisma.metricReading.create({
      data: { personId: idByName["דנה כהן"], metricId: grantHours.id, value: 247, asOf: recruited(2027, 2, 1) },
    });
  }

  // מאיה: assigned with no progress (older recruitment → clearly overdue),
  // except her first evaluation occurrence (+6), which is filled.
  const mayaCopy = await assignCopy(idByName["מאיה בר"]);
  const mayaEvalEvent = mayaCopy.recurringEvents.find((r) => r.label === "חוות דעת");
  if (mayaEvalEvent) {
    await prisma.evalEntry.create({
      data: {
        personId: idByName["מאיה בר"],
        recurringEventId: mayaEvalEvent.id,
        occurrenceOffset: 6,
        title: "חוות דעת · גיוס +6 חודשים",
        content: "חוות דעת תקופתית ראשונה: קליטה מצוינת בצוות, עומדת ביעדי הלמידה.",
      },
    });
  }
  // Plus one free-form entry.
  await prisma.evalEntry.create({
    data: {
      personId: idByName["מאיה בר"],
      title: "השתתפות בכנס ראייה ממוחשבת",
      content: "הציגה פוסטר בכנס השנתי.",
    },
  });

  // --- Users + access grants (default password "password" for all seeded users) ---
  const pw = hashPassword("password");
  // Admin: full authority. No grants needed — admin sees the whole tree.
  await prisma.user.create({
    data: { name: "רס״ן אדמין", email: "admin@example.com", username: "admin", passwordHash: pw, role: Role.ADMIN },
  });

  // Domain manager: edit over all of "תחום מחקר".
  await prisma.user.create({
    data: {
      name: "ראש תחום מחקר",
      email: "research.head@example.com",
      username: "research.head",
      passwordHash: pw,
      role: Role.MANAGER,
      grants: { create: [{ nodeId: research.id, level: AccessLevel.EDIT }] },
    },
  });

  // Team lead: edit over "צוות אלפא" only.
  await prisma.user.create({
    data: {
      name: "ראש צוות אלפא",
      email: "alpha.lead@example.com",
      username: "alpha.lead",
      passwordHash: pw,
      role: Role.MANAGER,
      grants: { create: [{ nodeId: teamAlpha.id, level: AccessLevel.EDIT }] },
    },
  });

  // Admin-staff viewer: view over "מדור פלטפורמה", plus a cross-tree view of "צוות בטא".
  await prisma.user.create({
    data: {
      name: "איש מנהלה (צפייה)",
      email: "viewer@example.com",
      username: "viewer",
      passwordHash: pw,
      role: Role.MANAGER,
      grants: {
        create: [
          { nodeId: platformSection.id, level: AccessLevel.VIEW },
          { nodeId: teamBeta.id, level: AccessLevel.VIEW },
        ],
      },
    },
  });

  console.log("Seed complete: org tree, 6 people, 4 users with grants.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
