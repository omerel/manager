/**
 * Verification for dashboard-filters.
 *
 * Two properties carry this change, and they pull in opposite directions:
 *
 *   the FRAMEWORK filter narrows everything  — it changes what is counted
 *   the KIND filter narrows only lists       — the gauge and the bars must
 *                                              come out identical across all
 *                                              three kinds
 *
 * The second is the one to guard hardest. It is not enforced by any type, it
 * reads like an oversight, and the obvious "improvement" for a future reader is
 * to make the gauge follow the filter — which is exactly the thing that was
 * decided against.
 *
 * The fixture is built with KNOWN, DIFFERENT numbers in two branches, so that
 * narrowing to one and getting the other's figures cannot pass unnoticed.
 *
 *   npx tsx scripts/verify-dashboard-filters.ts
 */
import { prisma } from "@/lib/prisma";
import { addMonths } from "@/lib/dates";
import { computeVisibility, visibilityFrom } from "@/lib/access";
import {
  buildGapTree,
  parseGapKind,
  findNode,
  flattenWithPaths,
  attentionList,
  narrowTree,
  isAttention,
  belongsInTree,
  type GapKind,
} from "@/lib/gap-dashboard";

const TAG = "dfverify";

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
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86400_000);
const daysAhead = (n: number) => new Date(Date.now() + n * 86400_000);

/**
 * A person with a plan holding exactly one point event, placed so the event is
 * overdue, approaching, or comfortably in the future.
 *
 * The offset is 12 months, NOT 0. A plan assignment carries a waiver line at
 * month 0 by default, and `beforeLine` waives anything at or before it — so an
 * event at offset 0 is waived and produces no gap at all. The placement date is
 * therefore worked backwards from the date the event should fall due.
 */
const OFFSET_MONTHS = 12;

async function makePerson(name: string, teamId: string, when: "overdue" | "approaching" | "met") {
  const due = when === "overdue" ? daysAgo(40) : when === "approaching" ? daysAhead(10) : daysAhead(400);
  const placement = addMonths(due, -OFFSET_MONTHS);
  const plan = await prisma.careerPlan.create({
    data: {
      name: `${TAG} תכנית ${name}`,
      isTemplate: false,
      pointEvents: { create: [{ label: `${TAG} אירוע`, offsetMonths: OFFSET_MONTHS }] },
    },
  });
  return prisma.person.create({
    data: {
      firstName: TAG, lastName: name, fullName: `${TAG} ${name}`,
      recruitmentDate: daysAgo(500), placementDate: placement,
      teamId, assignedPlanId: plan.id,
    },
  });
}

type Fx = { center: string; left: string; right: string; teamL: string; teamR: string };

async function scaffold(): Promise<Fx> {
  const center = await prisma.orgNode.create({ data: { name: `${TAG} מרכז`, kind: "CENTER" } });
  const left = await prisma.orgNode.create({ data: { name: `${TAG} תחום שמאל`, kind: "DOMAIN", parentId: center.id } });
  const right = await prisma.orgNode.create({ data: { name: `${TAG} תחום ימין`, kind: "DOMAIN", parentId: center.id } });
  const secL = await prisma.orgNode.create({ data: { name: `${TAG} מדור שמאל`, kind: "SECTION", parentId: left.id } });
  const secR = await prisma.orgNode.create({ data: { name: `${TAG} מדור ימין`, kind: "SECTION", parentId: right.id } });
  const teamL = await prisma.orgNode.create({ data: { name: `${TAG} צוות שמאל`, kind: "TEAM", parentId: secL.id } });
  const teamR = await prisma.orgNode.create({ data: { name: `${TAG} צוות ימין`, kind: "TEAM", parentId: secR.id } });

  // LEFT: 2 overdue, 1 approaching, 1 met      RIGHT: 1 overdue, 3 met
  await makePerson("שמאל-פיגור-א", teamL.id, "overdue");
  await makePerson("שמאל-פיגור-ב", teamL.id, "overdue");
  await makePerson("שמאל-מתקרב", teamL.id, "approaching");
  await makePerson("שמאל-עומד", teamL.id, "met");
  await makePerson("ימין-פיגור", teamR.id, "overdue");
  await makePerson("ימין-עומד-א", teamR.id, "met");
  await makePerson("ימין-עומד-ב", teamR.id, "met");
  await makePerson("ימין-עומד-ג", teamR.id, "met");

  return { center: center.id, left: left.id, right: right.id, teamL: teamL.id, teamR: teamR.id };
}

/** The whole tree, as an admin sees it. */
async function tree() {
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" }, include: { grants: true } });
  const vis = await computeVisibility({
    id: admin.id, name: admin.name, role: admin.role,
    grants: admin.grants.map((g) => ({ nodeId: g.nodeId, level: g.level })),
  });
  return { roots: await buildGapTree(vis, new Date()), vis };
}

/** What the page computes for a given choice — the same arithmetic, in one place. */
function figures(roots: ReturnType<typeof findNode>[] | Awaited<ReturnType<typeof tree>>["roots"]) {
  const rs = roots.filter(Boolean) as Awaited<ReturnType<typeof tree>>["roots"];
  const total = rs.reduce((s, r) => s + r.total, 0);
  const red = rs.reduce((s, r) => s + r.red, 0);
  return {
    total,
    red,
    overdueEvents: rs.reduce((s, r) => s + r.overdueEvents, 0),
    approachingEvents: rs.reduce((s, r) => s + r.approachingEvents, 0),
    compliance: total > 0 ? 100 - Math.round((red / total) * 100) : 100,
  };
}

async function main() {
  await cleanup();
  const f = await scaffold();
  try {
    const { roots: all } = await tree();
    const left = findNode(all, f.left)!;
    const right = findNode(all, f.right)!;
    const center = findNode(all, f.center)!;

    console.log("\n=== the fixture has genuinely different branches ===");
    check("left holds 4 people, 2 in arrears", left.total === 4 && left.red === 2, `${left.total} people, ${left.red} red`);
    check("right holds 4 people, 1 in arrears", right.total === 4 && right.red === 1, `${right.total} people, ${right.red} red`);
    check("so narrowing to one cannot pass by reporting the other's figures",
      left.red !== right.red, `${left.red} ≠ ${right.red}`);

    console.log("\n=== narrowing by framework changes what is counted ===");
    const fAll = figures([center]);
    const fLeft = figures([left]);
    const fRight = figures([right]);
    check("the centre totals both branches", fAll.total === 8, `${fAll.total}`);
    check("narrowed to the left, only the left's people", fLeft.total === 4, `${fLeft.total}`);
    check("and only the left's arrears", fLeft.red === 2, `${fLeft.red}`);
    check("narrowed to the right, a different compliance figure",
      fRight.compliance !== fLeft.compliance, `left ${fLeft.compliance}% vs right ${fRight.compliance}%`);
    check("the left's approaching event is counted in the left", fLeft.approachingEvents >= 1, `${fLeft.approachingEvents}`);
    check("and not in the right", fRight.approachingEvents === 0, `${fRight.approachingEvents}`);

    console.log("\n=== narrowing by kind does NOT move the headline figures ===");
    // the decision most likely to be "improved" away by a later reader
    const baseline = JSON.stringify(figures([left]));
    for (const kind of ["all", "overdue", "approaching"] as GapKind[]) {
      const narrowed = narrowTree([left], kind);
      check(`under ״${kind}״ the gauge and tiles are byte-identical`, JSON.stringify(figures(narrowed)) === baseline,
        JSON.stringify(figures(narrowed)) === baseline ? "unchanged" : `MOVED: ${JSON.stringify(figures(narrowed))}`);
    }

    console.log("\n=== the needs-attention panel lists the right people ===");
    const names = (kind: GapKind) => attentionList(left, kind).map((p) => p.name.replace(`${TAG} `, "")).sort();
    check("overdue → the two in arrears only",
      names("overdue").join() === ["שמאל-פיגור-א", "שמאל-פיגור-ב"].sort().join(), names("overdue").join());
    check("approaching → the one approaching only",
      names("approaching").join() === "שמאל-מתקרב", names("approaching").join());
    check("all → both kinds together", names("all").length === 3, names("all").join());
    check("and never anyone meeting their plan",
      !names("all").includes("שמאל-עומד"), "green people are not a problem list");
    check("arrears are listed before the approaching",
      attentionList(left, "all")[0].status === "OVERDUE", attentionList(left, "all")[0].status);

    console.log("\n=== ״all״ keeps the TREE whole — the trap in this change ===");
    const teamIn = (roots: Awaited<ReturnType<typeof tree>>["roots"], id: string) => findNode(roots, id)!.people.length;
    check("under ״all״ the team still lists every person, including those meeting their plan",
      teamIn(narrowTree([left], "all"), f.teamL) === 4, `${teamIn(narrowTree([left], "all"), f.teamL)} of 4`);
    check("under ״overdue״ it lists only the two in arrears",
      teamIn(narrowTree([left], "overdue"), f.teamL) === 2, `${teamIn(narrowTree([left], "overdue"), f.teamL)}`);
    check("under ״approaching״ only the one approaching",
      teamIn(narrowTree([left], "approaching"), f.teamL) === 1, `${teamIn(narrowTree([left], "approaching"), f.teamL)}`);
    check("narrowTree does not mutate the tree it was given",
      teamIn(all, f.teamL) === 4, `${teamIn(all, f.teamL)} — the original must survive`);

    console.log("\n=== the two rules, stated directly ===");
    check("a compliant person belongs in the tree under ״all״", belongsInTree("MET", "all"));
    check("but never in a problem list", !isAttention("MET", "all"));
    check("a person with no plan belongs in the tree under ״all״", belongsInTree(null, "all"));
    check("and is not a problem either", !isAttention(null, "all"));
    check("under a specific kind the tree and the problem list agree",
      belongsInTree("OVERDUE", "overdue") === isAttention("OVERDUE", "overdue"));

    console.log("\n=== reading the choice ===");
    check("an unknown kind falls back to all, rather than erroring", parseGapKind("nonsense") === "all");
    check("a missing kind is all", parseGapKind(undefined) === "all");
    check("a known kind is honoured", parseGapKind("overdue") === "overdue");
    check("a framework that does not exist resolves to nothing", findNode(all, "no-such-id") === null);

    console.log("\n=== a link cannot widen what its recipient sees ===");
    // a manager granted only the RIGHT domain follows a link naming the LEFT one
    const nodes = await prisma.orgNode.findMany();
    const narrowVis = visibilityFrom(nodes, {
      id: "x", name: "manager", role: "MANAGER", grants: [{ nodeId: f.right, level: "VIEW" }],
    });
    const theirRoots = await buildGapTree(narrowVis, new Date());
    check("the left branch is not in their forest at all", findNode(theirRoots, f.left) === null,
      "so the link finds nothing and falls back");
    check("they still see their own branch", findNode(theirRoots, f.right) !== null);
    const theirFigures = figures(theirRoots);
    check("and their figures are their own", theirFigures.total === 4 && theirFigures.red === 1,
      `${theirFigures.total} people, ${theirFigures.red} red`);
    check("the chooser offers them only what they can see",
      flattenWithPaths(theirRoots).every((o) => o.path.includes("ימין")),
      `${flattenWithPaths(theirRoots).length} frameworks offered`);

    console.log("\n=== the chooser ===");
    const opts = flattenWithPaths(all);
    const leftOpt = opts.find((o) => o.id === f.left)!;
    check("frameworks are labelled by full path", leftOpt.path.includes("▸"), leftOpt.path);
    check("every level is offered, teams included", opts.some((o) => o.id === f.teamL));
  } finally {
    await cleanup();
    const left = await prisma.person.count({ where: { fullName: { startsWith: TAG } } });
    const nodes = await prisma.orgNode.count({ where: { name: { startsWith: TAG } } });
    check("no fixtures left behind", left === 0 && nodes === 0, `${left} people, ${nodes} frameworks`);
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
  console.error("\nFAILED — the suite crashed:", e);
  await cleanup().catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
