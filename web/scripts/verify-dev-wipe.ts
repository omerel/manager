/**
 * Verification for dev-data-wipe — the category wipe and its gates.
 *
 * The wipe deletes WHOLE TABLES, so the suite brackets itself with the real
 * backup mechanism: a full portability zip before, importBundleBuffer after.
 * What portability does not carry (chat runs, movements, import snapshots)
 * stays gone — acceptable in the dev database this tool exists for.
 *
 *   npx tsx scripts/verify-dev-wipe.ts
 */
import { prisma } from "@/lib/prisma";
import { wipeCategories } from "@/lib/dev-wipe";
import { buildFullZip, importBundleBuffer } from "@/lib/portability";

const TAG = "dwverify";

let failures = 0;
let checks = 0;
function check(label: string, ok: boolean, detail = "") {
  checks++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

/** Everything the five categories span, plus one of each thing that must survive. */
async function plantFixture() {
  const node = await prisma.orgNode.create({ data: { name: `${TAG} מסגרת`, kind: "TEAM" } });
  const user = await prisma.user.findFirstOrThrow(); // any real user carries the FKs
  const person = await prisma.person.create({
    data: { firstName: TAG, lastName: "אדם", fullName: `${TAG} אדם`,
      recruitmentDate: new Date("2020-01-01"), placementDate: new Date("2020-01-01"), teamId: node.id },
  });
  const template = await prisma.careerPlan.create({ data: { name: `${TAG} תבנית`, isTemplate: true } });
  const copy = await prisma.careerPlan.create({ data: { name: `${TAG} עותק`, isTemplate: false, sourceTemplateId: template.id } });
  await prisma.planAssignment.create({ data: { personId: person.id, planId: copy.id, templateName: template.name } });
  await prisma.personDraft.create({ data: { createdBy: user.id, values: { fullName: `${TAG} טיוטה` } } });
  await prisma.personMovement.create({
    data: { kind: "CREATED", personId: person.id, personName: person.fullName, toTeamId: node.id,
      actorId: user.id, actorName: TAG, source: "manual" },
  });
  await prisma.importSnapshot.create({
    data: { filename: `${TAG}.xlsx`, filePath: `x/${TAG}`, headersHash: TAG, rows: [], uploadedById: user.id, uploadedByName: TAG },
  });
  await prisma.agentRun.create({ data: { userId: user.id, kind: "CHAT", prompt: `${TAG} שאלה` } });
  const rule = await prisma.rule.create({ data: { userId: user.id, name: `${TAG} חוק`, text: "בדוק" } });
  await prisma.agentRun.create({ data: { userId: user.id, kind: "RULE", ruleId: rule.id, prompt: `${TAG} ריצת חוק` } });
  await prisma.query.create({
    data: { senderNodeId: node.id, authorId: user.id, title: `${TAG} שאילתא`, body: "?", dueDate: new Date(),
      targets: { create: [{ nodeId: node.id }] } },
  });
  return { node, user, person, template, copy, rule };
}

const count = async () => ({
  people: await prisma.person.count(),
  templates: await prisma.careerPlan.count({ where: { isTemplate: true } }),
  copies: await prisma.careerPlan.count({ where: { isTemplate: false } }),
  assignments: await prisma.planAssignment.count(),
  drafts: await prisma.personDraft.count(),
  movements: await prisma.personMovement.count(),
  snapshots: await prisma.importSnapshot.count(),
  chatRuns: await prisma.agentRun.count({ where: { kind: "CHAT" } }),
  ruleRuns: await prisma.agentRun.count({ where: { kind: "RULE" } }),
  rules: await prisma.rule.count(),
  queries: await prisma.query.count(),
  users: await prisma.user.count(),
  orgNodes: await prisma.orgNode.count(),
  settings: await prisma.appSetting.count(),
  fieldDefs: await prisma.personFieldDef.count(),
  mappings: await prisma.importMapping.count(),
  activity: await prisma.activityLog.count(),
});

async function main() {
  console.log("backing the database up through portability…");
  const backup = await buildFullZip();

  try {
    console.log("\n=== each category deletes its roots, and nothing else ===");
    let f = await plantFixture();
    let before = await count();

    let counts = await wipeCategories(["career"]);
    let after = await count();
    check("careers alone: all plans gone", after.templates === 0 && after.copies === 0 && after.assignments === 0);
    check("...and every person remains, unassigned",
      after.people === before.people && (await prisma.person.count({ where: { assignedPlanId: null } })) === after.people);
    check("the reported count is the root count", counts[0].label === "קריירה" && counts[0].count === before.templates + before.copies, JSON.stringify(counts));

    counts = await wipeCategories(["people"]);
    after = await count();
    check("people: persons, drafts, movements, snapshots gone",
      after.people === 0 && after.drafts === 0 && after.movements === 0 && after.snapshots === 0);
    check("people count reported", counts[0].count === before.people);

    counts = await wipeCategories(["chat"]);
    after = await count();
    check("chat: CHAT runs gone, RULE runs stay", after.chatRuns === 0 && after.ruleRuns === before.ruleRuns);

    counts = await wipeCategories(["rules"]);
    after = await count();
    check("rules: rules gone and their runs cascade", after.rules === 0 && after.ruleRuns === 0);

    counts = await wipeCategories(["queries"]);
    after = await count();
    check("queries gone with their targets", after.queries === 0 && (await prisma.queryTarget.count()) === 0);

    check("users, org, settings, field defs, mappings and activity survive it all",
      after.users === before.users && after.orgNodes === before.orgNodes && after.settings === before.settings &&
      after.fieldDefs === before.fieldDefs && after.mappings === before.mappings && after.activity >= before.activity);

    console.log("\n=== people alone keep the templates, take the copies ===");
    f = await plantFixture();
    await wipeCategories(["people"]);
    check("the template survives a people-only wipe", (await prisma.careerPlan.count({ where: { id: f.template.id } })) === 1);
    check("the person's copy went with them", (await prisma.careerPlan.count({ where: { id: f.copy.id } })) === 0);

    console.log("\n=== all five at once, and the empty call ===");
    await plantFixture();
    const all = await wipeCategories(["people", "career", "chat", "rules", "queries"]);
    check("one pass takes all five", all.length === 5 && (await prisma.person.count()) === 0 && (await prisma.rule.count()) === 0);
    check("no categories → no-op", (await wipeCategories([])).length === 0);

    console.log("\n=== the action's gates ===");
    const { devWipe } = await import("@/lib/dev-wipe-actions");
    const fd = new FormData();
    fd.append("category", "people");
    const prevEnv = process.env.NODE_ENV;
    const prevGate = process.env.ENABLE_DATA_WIPE;
    (process.env as Record<string, string>).NODE_ENV = "production";
    delete process.env.ENABLE_DATA_WIPE;
    const inProd = await devWipe(null, fd);
    check("a production build refuses before anything else", inProd !== null && !inProd.ok && /ייצור/.test(!inProd.ok ? inProd.error : ""));
    // ENABLE_DATA_WIPE=1 opens the first gate — the NEXT gate (admin session)
    // now refuses instead, proving the override took without wiping anything
    (process.env as Record<string, string>).ENABLE_DATA_WIPE = "1";
    const gated = await devWipe(null, fd);
    check("ENABLE_DATA_WIPE=1 opens production up to the admin gate",
      gated !== null && !gated.ok && /אדמין/.test(!gated.ok ? gated.error : ""), !gated?.ok ? gated?.error : "");
    (process.env as Record<string, string>).NODE_ENV = prevEnv ?? "";
    if (prevGate === undefined) delete process.env.ENABLE_DATA_WIPE;
    else (process.env as Record<string, string>).ENABLE_DATA_WIPE = prevGate;
    const noSession = await devWipe(null, fd);
    check("outside an admin session the action refuses", noSession !== null && !noSession.ok);
  } finally {
    console.log("\nrestoring the database from the portability backup…");
    const restored = await importBundleBuffer(backup);
    check("the backup restored", restored.scope === "full" && (await prisma.user.count()) > 0);
    check("no fixture residue after restore", (await prisma.person.count({ where: { fullName: { contains: TAG } } })) === 0);
  }

  if (checks === 0) { console.log("\nFAILED — ZERO checks"); process.exitCode = 1; }
  else { console.log(failures ? `\nFAILED — ${checks} ran, ${failures} failed` : `\nall ${checks} checks passed`); process.exitCode = failures ? 1 : 0; }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("\nFAILED — the suite crashed:", e);
  await prisma.$disconnect();
  process.exit(1);
});
