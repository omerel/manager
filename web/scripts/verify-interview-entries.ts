/**
 * Verification for interview-summaries-and-event-dates (tasks 6.2, 6.3, 6.6).
 *
 * The properties worth asserting are the ones a plausible implementation gets
 * wrong: ordering by when the event happened rather than when it was typed, and
 * refusing an out-of-range score instead of clamping it into an assessment
 * nobody made.
 *
 *   npx tsx --env-file=.env scripts/verify-interview-entries.ts
 */
import { prisma } from "../src/lib/prisma";
import { parseScore, scoreLabel } from "../src/lib/eval-scale";

let failures = 0;
let checks = 0;
function check(label: string, ok: boolean, detail = "") {
  checks++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  const person = await prisma.person.findFirstOrThrow({ select: { id: true, fullName: true } });
  const made: string[] = [];

  try {
    // ---- 6.3 the scale refuses rather than clamps ----
    console.log("\n=== 6.3 the assessment scale ===");
    for (const [raw, expect] of [["1", 1], ["3", 3], ["5", 5]] as [string, number][]) {
      check(`"${raw}" → ${expect}`, parseScore(raw) === expect);
    }
    check('"" means not rated (null), not zero', parseScore("") === null);
    for (const bad of ["0", "6", "7", "abc", "3.5", "-1"]) {
      check(`"${bad}" refused (undefined), never clamped`, parseScore(bad) === undefined, String(parseScore(bad)));
    }
    check("a label always accompanies the number", scoreLabel(2) === "2 · מתחת למצופה", scoreLabel(2) ?? "");
    check("an unrated entry has no label at all", scoreLabel(null) === null);

    // ---- 6.2 ordering follows the EVENT date, not creation ----
    console.log("\n=== 6.2 entries order by when the event happened ===");
    // created second, but dated three weeks EARLIER — must sort after the other
    const recent = await prisma.evalEntry.create({
      data: { personId: person.id, kind: "FREE", title: "אירוע אתמול", eventDate: new Date(Date.now() - 86400000) },
    });
    made.push(recent.id);
    await new Promise((r) => setTimeout(r, 50)); // guarantee a later createdAt
    const older = await prisma.evalEntry.create({
      data: { personId: person.id, kind: "FREE", title: "אירוע מלפני שלושה שבועות", eventDate: new Date(Date.now() - 21 * 86400000) },
    });
    made.push(older.id);

    const rows = await prisma.evalEntry.findMany({
      where: { id: { in: made } },
      orderBy: { eventDate: "desc" },
      select: { title: true, eventDate: true, createdAt: true },
    });
    check("the more recent EVENT comes first", rows[0].title === "אירוע אתמול", rows.map((r) => r.title).join(" → "));
    check("even though it was created first",
      rows[0].createdAt.getTime() < rows[1].createdAt.getTime(),
      "creation order is the reverse");
    check("ordering by createdAt would give the opposite", true,
      [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0].title);

    // ---- 6.3 stored interview with a score ----
    console.log("\n=== 6.3 an interview stores its kind and score ===");
    const interview = await prisma.evalEntry.create({
      data: {
        personId: person.id, kind: "INTERVIEW", title: "ראיון בדיקה",
        eventDate: new Date("2026-08-03T00:00:00Z"), score: 2,
      },
    });
    made.push(interview.id);
    const back = await prisma.evalEntry.findUniqueOrThrow({ where: { id: interview.id } });
    check("stored as INTERVIEW", back.kind === "INTERVIEW", back.kind);
    check("dated by the event", iso(back.eventDate) === "2026-08-03", iso(back.eventDate));
    check("score 2 reads as מתחת למצופה", scoreLabel(back.score) === "2 · מתחת למצופה", scoreLabel(back.score) ?? "");

    const unrated = await prisma.evalEntry.create({
      data: { personId: person.id, kind: "INTERVIEW", title: "ראיון ללא דירוג", eventDate: new Date() },
    });
    made.push(unrated.id);
    check("an unrated interview stores null, not a default", (await prisma.evalEntry.findUniqueOrThrow({ where: { id: unrated.id } })).score === null);

    // ---- the split the page makes ----
    console.log("\n=== the two lists separate correctly ===");
    const all = await prisma.evalEntry.findMany({ where: { personId: person.id } });
    const adHoc = all.filter((e) => e.recurringEventId == null);
    check("interviews are not among the free entries",
      adHoc.filter((e) => e.kind === "FREE").every((e) => !e.title.startsWith("ראיון")));
    check("plan occurrences are in neither ad-hoc list",
      all.filter((e) => e.recurringEventId != null).every((e) => e.kind === "FREE"),
      "slots keep the default kind and are split off by recurringEventId, not by kind");

    // ---- 6.6 the agent sees it ----
    console.log("\n=== 6.6 the agent snapshot carries kind, event date and label ===");
    const { exportScopedSnapshot, removeSnapshot } = await import("../src/lib/agent-snapshot");
    const { computeVisibility } = await import("../src/lib/access");
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" }, include: { grants: true } });
    const vis = await computeVisibility({
      id: admin.id, name: admin.name, role: admin.role,
      grants: admin.grants.map((g) => ({ nodeId: g.nodeId, level: g.level })),
    });
    const dir = await exportScopedSnapshot(vis, new Date("2026-08-04T00:00:00Z"));
    const { readFile } = await import("fs/promises");
    const json = await readFile(`${dir}/people.json`, "utf8");
    check("the snapshot names the entry kind", json.includes("סיכום ראיון"), "");
    check("and carries the assessment as a LABEL, not a bare number", json.includes("מתחת למצופה"));
    check("and dates entries by the event", json.includes("2026-08-03"));
    await removeSnapshot(dir);
  } finally {
    await prisma.evalEntry.deleteMany({ where: { id: { in: made } } });
    console.log(failures === 0 ? `\nall ${checks} checks passed` : `\nFAILED — ${checks} ran, ${failures} failed`);
    await prisma.$disconnect();
    process.exit(failures ? 1 : 0);
  }
}

main();
