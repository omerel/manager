/**
 * Verification for admin-activity-log (tasks 4.1–4.4, 4.6).
 *
 * The interesting properties are the ones a naive implementation gets wrong:
 * an entry must survive the deletion of its subject, must not be rewritten when
 * an actor is renamed, and must never take the action down with it.
 *
 *   npx tsx --env-file=.env scripts/verify-activity-log.ts
 */
import { prisma } from "../src/lib/prisma";

let failures = 0;
let checks = 0;
function check(label: string, ok: boolean, detail = "") {
  checks++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

/** Write an entry the way logActivity does, without needing a request session. */
async function writeEntry(actor: { id: string; name: string }, e: {
  action: string;
  description: string;
  subjectType?: string;
  subjectId?: string;
}) {
  return prisma.activityLog.create({
    data: {
      actorId: actor.id,
      actorName: actor.name,
      action: e.action,
      description: e.description,
      subjectType: e.subjectType ?? null,
      subjectId: e.subjectId ?? null,
    },
  });
}

/**
 * Which action families are instrumented at all. Two families are proven end to
 * end elsewhere (a person and a plan created through the real forms); this
 * catches the different failure — a whole family with no logging in it, which no
 * single end-to-end test would notice.
 */
async function families() {
  const { readFileSync } = await import("fs");
  console.log("\n=== 4.1 every action family is instrumented ===");
  const expected: [string, string, number][] = [
    ["people", "src/lib/person-actions.ts", 8],
    ["plans", "src/lib/plan-actions.ts", 13],
    ["org", "src/lib/org-actions.ts", 4],
    ["access", "src/lib/access-actions.ts", 5],
    ["auth", "src/lib/auth-actions.ts", 1],
    ["evaluations", "src/lib/eval-actions.ts", 3],
    ["rules", "src/lib/rules-actions.ts", 2],
    ["intake", "src/lib/intake-actions.ts", 2],
    ["config import", "src/lib/portability-actions.ts", 1],
    ["branding", "src/lib/branding-actions.ts", 3],
  ];
  let total = 0;
  for (const [family, file, atLeast] of expected) {
    const n = (readFileSync(file, "utf8").match(/await log(Activity|Item)\(/g) ?? []).length;
    total += n;
    check(`${family}: at least ${atLeast} recorded acts`, n >= atLeast, `${n} in ${file}`);
  }
  console.log(`  (${total} recorded acts in total)`);
}

async function main() {
  await families();
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" }, select: { id: true, name: true } });
  const team = await prisma.orgNode.findFirst({ where: { kind: "TEAM" } });
  // start from a clean slate regardless of how a previous run ended
  await prisma.person.deleteMany({ where: { fullName: "נמחק לוג" } });
  await prisma.activityLog.deleteMany({ where: { action: { startsWith: "test." } } });
  const written: string[] = [];

  try {
    // ---- 4.2 the entry outlives its subject ----
    console.log("\n=== 4.2 an entry survives the deletion of its subject ===");
    const victim = await prisma.person.create({
      data: {
        firstName: "נמחק", lastName: "לוג", fullName: "נמחק לוג",
        birthDate: new Date("1990-01-01"), recruitmentDate: new Date("2020-01-01"),
        placementDate: new Date("2020-01-01"), teamId: team?.id ?? null,
      },
    });
    const e1 = await writeEntry(admin, {
      action: "person.delete", description: `מחק את ${victim.fullName}`, subjectType: "person", subjectId: victim.id,
    });
    written.push(e1.id);
    await prisma.person.delete({ where: { id: victim.id } });
    const after = await prisma.activityLog.findUnique({ where: { id: e1.id } });
    check("the entry still exists after its subject is gone", after !== null);
    check("and still names them", after?.description.includes("נמחק לוג") === true, after?.description ?? "");
    check("no foreign key blocked or cascaded the deletion",
      (await prisma.person.count({ where: { id: victim.id } })) === 0);

    // ---- 4.3 renaming the actor does not rewrite history ----
    console.log("\n=== 4.3 renaming an actor leaves earlier entries alone ===");
    // Clear any leftover first: a previous run killed mid-way (a pipe closing
    // on `head` is enough) never reaches its cleanup, and this create would then
    // fail on the unique email — which is how one run reported 13 checks
    // instead of 20 while the code was fine.
    await prisma.user.deleteMany({ where: { email: "log.rename@example.invalid" } });
    const tmpUser = await prisma.user.create({
      data: { name: "שם ישן", email: "log.rename@example.invalid", username: "log.rename", role: "MANAGER" },
    });
    const e2 = await writeEntry(tmpUser, { action: "person.update", description: "ערך מישהו" });
    written.push(e2.id);
    await prisma.user.update({ where: { id: tmpUser.id }, data: { name: "שם חדש" } });
    const stillOld = await prisma.activityLog.findUnique({ where: { id: e2.id } });
    check("the entry keeps the name recorded at the time", stillOld?.actorName === "שם ישן", stillOld?.actorName ?? "");

    // and it survives the account being deleted, too
    await prisma.user.delete({ where: { id: tmpUser.id } });
    const orphan = await prisma.activityLog.findUnique({ where: { id: e2.id } });
    check("and survives the account itself being deleted", orphan !== null);

    // ---- 4.4 a failing log does not fail the action ----
    console.log("\n=== 4.4 recording never disturbs what it observes ===");
    const { logActivity } = await import("../src/lib/activity-log");
    // no request session here, so logActivity finds no actor and must simply
    // return — the important part is that it does NOT throw
    let threw = false;
    try {
      await logActivity({ action: "test.noop", description: "לא אמור להיכתב" });
    } catch {
      threw = true;
    }
    check("logActivity does not throw when it cannot resolve an actor", !threw);
    check("and wrote nothing", (await prisma.activityLog.count({ where: { action: "test.noop" } })) === 0);

    // ---- 4.6 retention ----
    console.log("\n=== 4.6 retention removes old entries, and 0 keeps them ===");
    const old = await prisma.activityLog.create({
      data: {
        actorId: admin.id, actorName: admin.name, action: "test.old", description: "ישן",
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // two days ago
      },
    });
    written.push(old.id);
    const { pruneActivityLog } = await import("../src/lib/activity-log");

    process.env.ACTIVITY_LOG_DAYS = "0";
    await pruneActivityLog();
    check("with ACTIVITY_LOG_DAYS=0 nothing is removed",
      (await prisma.activityLog.count({ where: { id: old.id } })) === 1);

    process.env.ACTIVITY_LOG_DAYS = "1";
    await pruneActivityLog();
    check("with ACTIVITY_LOG_DAYS=1 a two-day-old entry is removed",
      (await prisma.activityLog.count({ where: { id: old.id } })) === 0);

    // a fresh entry must NOT be swept by the same run
    const fresh = await writeEntry(admin, { action: "test.fresh", description: "חדש" });
    written.push(fresh.id);
    await pruneActivityLog();
    check("a fresh entry is left alone", (await prisma.activityLog.count({ where: { id: fresh.id } })) === 1);
  } finally {
    process.env.ACTIVITY_LOG_DAYS = "30";
    await prisma.activityLog.deleteMany({ where: { id: { in: written } } });
    await prisma.activityLog.deleteMany({ where: { action: { startsWith: "test." } } });
    await prisma.user.deleteMany({ where: { email: "log.rename@example.invalid" } });
    await prisma.person.deleteMany({ where: { fullName: "נמחק לוג" } });
    console.log(failures === 0 ? `\nall ${checks} checks passed` : `\nFAILED — ${checks} ran, ${failures} failed`);
    await prisma.$disconnect();
    process.exit(failures ? 1 : 0);
  }
}

main();
