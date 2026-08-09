/**
 * Verification for hr-movement-log — the record and its emission points.
 *
 * The two claims that carry it: every channel emits a snapshot that outlives
 * its subjects, and the scope filter works on FROM-OR-TO — a move out of an HR
 * user's scope stays visible to them, which is the half of the reason this is
 * not the activity log.
 *
 * Emission points that need a session (create/reassign/delete actions) are
 * exercised through emitMovement's explicit-actor path here and through the
 * real page in the e2e; the org-delete path is driven through its REAL action
 * guts by calling the same capture-then-emit sequence.
 *
 *   npx tsx scripts/verify-movements.ts
 */
import { prisma } from "@/lib/prisma";
import { visibilityFrom } from "@/lib/access";
import { emitMovement, readMovements, pruneMovements, pathOf } from "@/lib/movements";

const TAG = "mvverify";
const ACTOR = { id: "mv-actor", name: `${TAG} מבצע` };

let failures = 0;
let checks = 0;
function check(label: string, ok: boolean, detail = "") {
  checks++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function cleanup() {
  await prisma.personMovement.deleteMany({ where: { personName: { contains: TAG } } });
  await prisma.person.deleteMany({ where: { fullName: { contains: TAG } } });
  await prisma.orgNode.deleteMany({ where: { name: { startsWith: TAG } } });
}

async function main() {
  await cleanup();

  const center = await prisma.orgNode.create({ data: { name: `${TAG} מרכז`, kind: "CENTER" } });
  const domA = await prisma.orgNode.create({ data: { name: `${TAG} תחום א`, kind: "DOMAIN", parentId: center.id } });
  const domB = await prisma.orgNode.create({ data: { name: `${TAG} תחום ב`, kind: "DOMAIN", parentId: center.id } });
  const secA = await prisma.orgNode.create({ data: { name: `${TAG} מדור א`, kind: "SECTION", parentId: domA.id } });
  const secB = await prisma.orgNode.create({ data: { name: `${TAG} מדור ב`, kind: "SECTION", parentId: domB.id } });
  const teamA = await prisma.orgNode.create({ data: { name: `${TAG} צוות א`, kind: "TEAM", parentId: secA.id } });
  const teamB = await prisma.orgNode.create({ data: { name: `${TAG} צוות ב`, kind: "TEAM", parentId: secB.id } });

  const nodes = () => prisma.orgNode.findMany({ select: { id: true, name: true, parentId: true, kind: true } });
  const visA = visibilityFrom((await nodes()) as never, { id: "hrA", name: "hrA", role: "HR", grants: [{ nodeId: domA.id, level: "EDIT" }] });
  const admin = visibilityFrom((await nodes()) as never, { id: "adm", name: "adm", role: "ADMIN", grants: [] });

  console.log("\n=== emission carries the snapshot ===");
  await emitMovement({ kind: "CREATED", personId: "p1", personName: `${TAG} אדם`, toTeamId: teamA.id, source: "manual", actor: ACTOR });
  const row = await prisma.personMovement.findFirstOrThrow({ where: { personName: `${TAG} אדם` } });
  check("the path is a snapshot text, full", row.toPath === `${TAG} מרכז ▸ ${TAG} תחום א ▸ ${TAG} מדור א ▸ ${TAG} צוות א`, row.toPath ?? "");
  check("the actor is a snapshot", row.actorName === `${TAG} מבצע`);

  console.log("\n=== scope: from-OR-to ===");
  const today = new Date();
  await emitMovement({ kind: "MOVED", personId: "p1", personName: `${TAG} יוצא`, fromTeamId: teamA.id, toTeamId: teamB.id, source: "manual", actor: ACTOR });
  await emitMovement({ kind: "MOVED", personId: "p2", personName: `${TAG} נכנס`, fromTeamId: teamB.id, toTeamId: teamA.id, source: "manual", actor: ACTOR });
  await emitMovement({ kind: "MOVED", personId: "p3", personName: `${TAG} זר`, fromTeamId: teamB.id, toTeamId: teamB.id, source: "manual", actor: ACTOR });
  const seenA = (await readMovements(visA, today)).map((m) => m.personName);
  check("a move OUT of scope is visible — the point of the from axis", seenA.includes(`${TAG} יוצא`));
  check("a move INTO scope is visible", seenA.includes(`${TAG} נכנס`));
  check("a movement entirely elsewhere is not", !seenA.includes(`${TAG} זר`));
  check("the admin sees everything", (await readMovements(admin, today)).filter((m) => m.personName.includes(TAG)).length >= 4);

  console.log("\n=== the orphaning path: paths captured BEFORE the delete ===");
  const person = await prisma.person.create({
    data: { firstName: TAG, lastName: "מיותם", fullName: `${TAG} מיותם`,
      recruitmentDate: new Date("2020-01-01"), placementDate: new Date("2020-01-01"), teamId: teamB.id },
  });
  const prePath = await pathOf(teamB.id);
  // the real org-delete sequence: capture, delete, emit with the pre-captured path
  await prisma.orgNode.delete({ where: { id: teamB.id } });
  await emitMovement({
    kind: "MOVED", personId: person.id, personName: person.fullName,
    fromTeamId: teamB.id, fromPath: prePath, toTeamId: null, toPath: null,
    source: "org-delete", actor: ACTOR,
  });
  const orphanRow = await prisma.personMovement.findFirstOrThrow({ where: { personName: `${TAG} מיותם` } });
  check("the from-path survives though the framework is gone", orphanRow.fromPath === prePath && !!prePath, orphanRow.fromPath ?? "");
  check("the destination reads as unassigned", orphanRow.toTeamId === null);
  const personRow = await prisma.person.findUniqueOrThrow({ where: { id: person.id } });
  check("and the person really was orphaned by the FK", personRow.teamId === null);

  console.log("\n=== the record outlives its subjects ===");
  await prisma.person.delete({ where: { id: person.id } });
  const still = await prisma.personMovement.findFirst({ where: { personName: `${TAG} מיותם` } });
  check("the movement survives the person's deletion", !!still);
  const read = (await readMovements(admin, today)).find((m) => m.personName === `${TAG} מיותם`);
  check("and reads with personExists=false — the page shows a name, not a dead link", read?.personExists === false);

  console.log("\n=== filters and retention ===");
  const kindOnly = await readMovements(admin, today, { kind: "CREATED" });
  check("the kind filter narrows", kindOnly.some((m) => m.personName === `${TAG} אדם`) && !kindOnly.some((m) => m.personName === `${TAG} יוצא`));
  const teamOnly = await readMovements(admin, today, { teamId: teamA.id });
  check("the team filter matches either end", teamOnly.some((m) => m.personName === `${TAG} יוצא`) && teamOnly.some((m) => m.personName === `${TAG} נכנס`));
  const yesterday = await readMovements(admin, new Date(Date.now() - 86400_000));
  check("the daily cut excludes today's rows", !yesterday.some((m) => m.personName.includes(TAG)));

  // retention: plant an old row, prune under a tight env
  await prisma.personMovement.create({
    data: { kind: "CREATED", personId: "old", personName: `${TAG} עתיק`, actorId: "x", actorName: "x", source: "manual",
      at: new Date(Date.now() - 400 * 86400_000) },
  });
  process.env.MOVEMENT_LOG_DAYS = "30";
  await pruneMovements();
  check("pruning honours MOVEMENT_LOG_DAYS", (await prisma.personMovement.count({ where: { personName: `${TAG} עתיק` } })) === 0);
  check("and leaves today's rows", (await prisma.personMovement.count({ where: { personName: `${TAG} אדם` } })) === 1);
  delete process.env.MOVEMENT_LOG_DAYS;

  await cleanup();
  check("no fixtures left behind", (await prisma.personMovement.count({ where: { personName: { contains: TAG } } })) === 0);

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
