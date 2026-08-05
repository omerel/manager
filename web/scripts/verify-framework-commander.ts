/**
 * Verification for framework-commander — the rules layer.
 *
 * The claim under test is a pair, and the second half is the one that rots
 * quietly if nobody checks it:
 *
 *   command REQUIRES access — refused when the framework is out of reach
 *   command CONFERS none    — appointing creates no grant and widens nothing
 *
 * So the centre of this suite is not the happy path but the two negatives: an
 * appointment that must be refused, and a visibility set that must come out
 * byte-identical after an appointment succeeds.
 *
 * This half deliberately does NOT call the server actions: they begin with
 * requireAdmin(), which needs a request scope, and an action that throws
 * "cookies was called outside a request scope" would satisfy every check that
 * merely asserts "it was refused" — a suite that passes for the wrong reason is
 * worse than no suite. The actions are covered end-to-end, through the real
 * forms, by verify-framework-commander-e2e.ts.
 *
 * Every fixture is created and destroyed here, and cleanup runs BEFORE the
 * build as well as after, so a run killed halfway cannot fail the next one.
 *
 *   npx tsx scripts/verify-framework-commander.ts
 */
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { computeVisibility } from "@/lib/access";
import {
  assertCanCommand,
  assertFrameworkFree,
  assertGrantIsRemovable,
  canCommand,
  commandableBy,
  isCommandConflict,
} from "@/lib/commander";
import type { AccessLevel, Role } from "@/generated/prisma/client";

const TAG = "fcverify";
const MAIL = `@${TAG}.invalid`;

let failures = 0;
let checks = 0;
function check(label: string, ok: boolean, detail = "") {
  checks++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

/** Run something expected to throw; returns the message, or null if it did not. */
async function refusal(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    return (e as Error).message ?? "";
  }
}

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: { endsWith: MAIL } } });
  await prisma.orgNode.deleteMany({ where: { name: { startsWith: TAG } } });
}

type Fixture = { center: string; domain: string; sectionA: string; sectionB: string; teamA: string };

async function scaffold(): Promise<Fixture> {
  const center = await prisma.orgNode.create({ data: { name: `${TAG} מרכז`, kind: "CENTER" } });
  const domain = await prisma.orgNode.create({ data: { name: `${TAG} תחום`, kind: "DOMAIN", parentId: center.id } });
  const sectionA = await prisma.orgNode.create({ data: { name: `${TAG} מדור א`, kind: "SECTION", parentId: domain.id } });
  const sectionB = await prisma.orgNode.create({ data: { name: `${TAG} מדור ב`, kind: "SECTION", parentId: domain.id } });
  const teamA = await prisma.orgNode.create({ data: { name: `${TAG} צוות א`, kind: "TEAM", parentId: sectionA.id } });
  return { center: center.id, domain: domain.id, sectionA: sectionA.id, sectionB: sectionB.id, teamA: teamA.id };
}

async function mkUser(
  handle: string,
  role: Role = "MANAGER",
  grants: { nodeId: string; level: AccessLevel }[] = [],
  commandsNodeId: string | null = null,
) {
  const u = await prisma.user.create({
    data: {
      name: `${TAG}-${handle}`,
      email: `${handle}${MAIL}`,
      username: `${TAG}-${handle}`,
      passwordHash: hashPassword("x"),
      role,
      commandsNodeId,
      grants: { create: grants },
    },
  });
  return u.id;
}

async function visibilityOf(userId: string) {
  const u = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { grants: { select: { nodeId: true, level: true } } },
  });
  const v = await computeVisibility({ id: u.id, name: u.name, role: u.role, grants: u.grants });
  return [...v.nodeIds].sort().join(",");
}

/** 1 — the condition on appointment. */
async function theCondition(f: Fixture) {
  console.log("\n=== command requires access ===");

  check("a framework outside every granted subtree is out of reach",
    !(await canCommand("MANAGER", [{ nodeId: f.sectionB, level: "VIEW" }], f.sectionA)));

  const msg = await refusal(() => assertCanCommand("MANAGER", [{ nodeId: f.sectionB, level: "VIEW" }], f.sectionA));
  check("appointing there is refused", msg !== null, msg?.slice(0, 60) ?? "IT SUCCEEDED");
  check("and the refusal names the framework by path", !!msg?.includes("מדור א"), msg?.slice(0, 90) ?? "");
  check("naming its full path, not just its name", !!msg?.includes("▸"), msg?.slice(0, 90) ?? "");

  check("a VIEW grant on the domain reaches a team three levels down",
    await canCommand("MANAGER", [{ nodeId: f.domain, level: "VIEW" }], f.teamA));
  check("view level is enough — the question is reach, not permission",
    await canCommand("MANAGER", [{ nodeId: f.teamA, level: "VIEW" }], f.teamA));
  check("an admin, who sees the whole tree, reaches any framework",
    await canCommand("ADMIN", [], f.sectionB));
  check("a manager with no grants at all reaches nothing",
    !(await canCommand("MANAGER", [], f.teamA)));

  // the chooser must offer exactly what the check would accept
  const offered = (await commandableBy("MANAGER", [{ nodeId: f.sectionA, level: "VIEW" }])).map((o) => o.id);
  check("the chooser offers the granted node and its descendants",
    offered.includes(f.sectionA) && offered.includes(f.teamA), `${offered.length} options`);
  check("and never a framework the check would refuse",
    !offered.includes(f.sectionB) && !offered.includes(f.domain));
  for (const id of offered) {
    if (!(await canCommand("MANAGER", [{ nodeId: f.sectionA, level: "VIEW" }], id))) {
      check("every offered option passes the check", false, id);
      return;
    }
  }
  check("every offered option passes the check", true, `${offered.length} verified`);
}

/** 2 — appointing confers nothing. */
async function confersNothing(f: Fixture) {
  console.log("\n=== command confers no access ===");

  const u = await mkUser("neutral", "MANAGER", [{ nodeId: f.domain, level: "VIEW" }]);
  const before = await visibilityOf(u);
  const grantsBefore = JSON.stringify(
    await prisma.accessGrant.findMany({ where: { userId: u }, select: { nodeId: true, level: true }, orderBy: { nodeId: "asc" } }),
  );

  await prisma.user.update({ where: { id: u }, data: { commandsNodeId: f.sectionA } });

  check("after appointing, visibility is byte-identical", (await visibilityOf(u)) === before);
  const grantsAfter = JSON.stringify(
    await prisma.accessGrant.findMany({ where: { userId: u }, select: { nodeId: true, level: true }, orderBy: { nodeId: "asc" } }),
  );
  check("and the grant list is byte-identical", grantsAfter === grantsBefore);
  check("no grant was invented on the commanded framework",
    (await prisma.accessGrant.count({ where: { userId: u, nodeId: f.sectionA } })) === 0);

  const v = await prisma.user.findUniqueOrThrow({ where: { id: u }, include: { grants: true } });
  check("the level over the commanded framework is still VIEW, not promoted", v.grants.every((g) => g.level === "VIEW"));

  await prisma.user.update({ where: { id: u }, data: { commandsNodeId: null } });
  check("clearing the command leaves the grants intact", (await visibilityOf(u)) === before);
  check("and the grant list is still byte-identical",
    JSON.stringify(await prisma.accessGrant.findMany({ where: { userId: u }, select: { nodeId: true, level: true }, orderBy: { nodeId: "asc" } })) === grantsBefore);
}

/** 3 — one commander per framework. */
async function oneCommander(f: Fixture) {
  console.log("\n=== one framework, one commander ===");

  const first = await mkUser("holder", "MANAGER", [{ nodeId: f.domain, level: "EDIT" }], f.sectionA);
  const second = await mkUser("rival", "MANAGER", [{ nodeId: f.domain, level: "EDIT" }]);

  const msg = await refusal(() => assertFrameworkFree(f.sectionA, second));
  check("a second commander is refused", msg !== null, msg?.slice(0, 70) ?? "IT SUCCEEDED");
  check("and the refusal names the current commander", !!msg?.includes(`${TAG}-holder`), msg?.slice(0, 100) ?? "");
  check("and names the framework", !!msg?.includes("מדור א"));

  check("re-saving your own command is not a conflict with yourself",
    (await refusal(() => assertFrameworkFree(f.sectionA, first))) === null);

  // the database, not the check, is what actually guarantees it
  const raced = await refusal(() => prisma.user.update({ where: { id: second }, data: { commandsNodeId: f.sectionA } }));
  check("and the unique index refuses it even with no check in the way", raced !== null, raced?.slice(0, 60) ?? "IT SUCCEEDED");
  let caught: unknown = null;
  try {
    await prisma.user.update({ where: { id: second }, data: { commandsNodeId: f.sectionA } });
  } catch (e) {
    caught = e;
  }
  check("that database error is recognised as a command conflict", isCommandConflict(caught));
  check("an unrelated unique violation is NOT", !isCommandConflict({ code: "P2002", meta: { target: ["email"] } }));
  check("the rival still commands nothing",
    (await prisma.user.findUniqueOrThrow({ where: { id: second }, select: { commandsNodeId: true } })).commandsNodeId === null);

  // clear, then assign
  await prisma.user.update({ where: { id: first }, data: { commandsNodeId: null } });
  check("after clearing, the framework is free", (await refusal(() => assertFrameworkFree(f.sectionA, second))) === null);
  await prisma.user.update({ where: { id: second }, data: { commandsNodeId: f.sectionA } });
  check("clear-then-assign succeeds",
    (await prisma.user.findUniqueOrThrow({ where: { id: second }, select: { commandsNodeId: true } })).commandsNodeId === f.sectionA);
}

/** 4 — access is not withdrawn from beneath a command. */
async function noWithdrawal(f: Fixture) {
  console.log("\n=== access is not withdrawn from under a command ===");

  const u = await mkUser("commander", "MANAGER", [{ nodeId: f.domain, level: "EDIT" }], f.teamA);
  const covering = await prisma.accessGrant.findFirstOrThrow({ where: { userId: u, nodeId: f.domain } });

  const msg = await refusal(() => assertGrantIsRemovable(covering.id));
  check("removing the covering grant is refused", msg !== null, msg?.slice(0, 70) ?? "IT SUCCEEDED");
  check("and the refusal names the commanded framework", !!msg?.includes("צוות א"), msg?.slice(0, 100) ?? "");

  // a second, redundant grant makes the first removable
  const redundant = await prisma.accessGrant.create({ data: { userId: u, nodeId: f.teamA, level: "VIEW" } });
  check("once another grant covers the framework, removal is allowed",
    (await refusal(() => assertGrantIsRemovable(covering.id))) === null);
  check("and the redundant one is then the blocker instead",
    (await refusal(() => assertGrantIsRemovable(redundant.id))) === null,
    "the domain grant still covers it");

  // with only the redundant one left, it becomes the blocker
  await prisma.accessGrant.delete({ where: { id: covering.id } });
  check("with the domain grant gone, the last covering grant is protected",
    (await refusal(() => assertGrantIsRemovable(redundant.id))) !== null);

  const unrelated = await prisma.accessGrant.create({ data: { userId: u, nodeId: f.sectionB, level: "VIEW" } });
  check("an unrelated grant is removable while commanding",
    (await refusal(() => assertGrantIsRemovable(unrelated.id))) === null);

  const nobody = await mkUser("plain", "MANAGER", [{ nodeId: f.sectionB, level: "VIEW" }]);
  const g = await prisma.accessGrant.findFirstOrThrow({ where: { userId: nobody } });
  check("a non-commander's grants are removable as before",
    (await refusal(() => assertGrantIsRemovable(g.id))) === null);
}

/** 5 — deleting the framework releases the command. */
async function frameworkDeleted(f: Fixture) {
  console.log("\n=== deleting the framework releases the command ===");

  const u = await mkUser("doomed", "MANAGER", [{ nodeId: f.sectionB, level: "EDIT" }], f.sectionB);
  await prisma.rule.create({ data: { userId: u, name: `${TAG} כלל`, text: "?" } });

  await prisma.orgNode.delete({ where: { id: f.sectionB } });

  const after = await prisma.user.findUnique({ where: { id: u }, include: { rules: true } });
  check("the user survives deletion of the framework they commanded", after !== null);
  check("their command is released", after?.commandsNodeId === null, String(after?.commandsNodeId));
  check("their private rules are untouched", after?.rules.length === 1, `${after?.rules.length}`);
}

async function main() {
  await cleanup(); // a killed previous run must not be able to fail this one
  const f = await scaffold();
  try {
    await theCondition(f);
    await confersNothing(f);
    await oneCommander(f);
    await noWithdrawal(f);
    await frameworkDeleted(f);
  } finally {
    await cleanup();
    const left = await prisma.user.count({ where: { email: { endsWith: MAIL } } });
    const nodesLeft = await prisma.orgNode.count({ where: { name: { startsWith: TAG } } });
    check("no fixtures left behind", left === 0 && nodesLeft === 0, `${left} users, ${nodesLeft} frameworks`);
  }

  if (checks === 0) {
    console.log("\nFAILED — the suite ran ZERO checks");
    process.exitCode = 1;
  } else {
    console.log(failures === 0 ? `\nall ${checks} checks passed` : `\nFAILED — ${checks} ran, ${failures} failed`);
    process.exitCode = failures ? 1 : 0;
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  // a crash must never read as a pass
  console.error("\nFAILED — the suite crashed:", e);
  await cleanup().catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
