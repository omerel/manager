/**
 * Verification for unassigned-tree-node — the synthetic «לא משויכים» node and
 * the parenthesized tile count.
 *
 * Needs the dev server on :4321 for the rendered-dashboard checks.
 *
 *   npx tsx scripts/verify-unassigned-node.ts
 */
import { prisma } from "@/lib/prisma";
import { addMonths } from "@/lib/dates";
import { computeVisibility, visibilityFrom } from "@/lib/access";
import { buildGapTree, findNode, flattenWithPaths, narrowTree, UNASSIGNED_NODE_ID } from "@/lib/gap-dashboard";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

const TAG = "unverify";
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
  // the dev database holds OTHER unassigned people too — every count below is
  // asserted relatively (baseline vs after), never as an absolute
  const center = await prisma.orgNode.create({ data: { name: `${TAG} מרכז`, kind: "CENTER" } });
  const domain = await prisma.orgNode.create({ data: { name: `${TAG} תחום`, kind: "DOMAIN", parentId: center.id } });
  const section = await prisma.orgNode.create({ data: { name: `${TAG} מדור`, kind: "SECTION", parentId: domain.id } });
  const team = await prisma.orgNode.create({ data: { name: `${TAG} צוות`, kind: "TEAM", parentId: section.id } });
  const admin = await prisma.user.create({
    data: { name: `${TAG} אדמין`, email: `${TAG}@verify.invalid`, username: `${TAG}-adm`, passwordHash: hashPassword("x"), role: "ADMIN" },
  });

  const mk = (last: string, teamId: string | null, planId?: string) =>
    prisma.person.create({
      data: { firstName: TAG, lastName: last, fullName: `${TAG} ${last}`,
        recruitmentDate: new Date("2020-01-01"), placementDate: new Date("2020-01-01"),
        teamId, assignedPlanId: planId ?? null },
    });

  try {
    const today = new Date();
    const vis = async () =>
      computeVisibility({ id: admin.id, name: admin.name, role: "ADMIN", grants: [] });

    console.log("=== the node exists under the center, and counts what it holds ===");
    const before = await buildGapTree(await vis(), today);
    const baseline = findNode(before, UNASSIGNED_NODE_ID)?.total ?? 0;

    await mk("משויך", team.id);
    // an unassigned person whose kept plan is OVERDUE — their gap must not vanish with their framework
    const plan = await prisma.careerPlan.create({
      data: { name: `${TAG} תכנית`, isTemplate: false,
        pointEvents: { create: [{ label: `${TAG} אירוע`, offsetMonths: 12 }] } },
    });
    const overdueGuy = await mk("ללא-פיגור", null, plan.id);
    await prisma.planAssignment.create({
      data: { personId: overdueGuy.id, planId: plan.id, templateName: plan.name, waiverOffsetMonths: 0 },
    });
    await mk("ללא-נקי", null);

    const roots = await buildGapTree(await vis(), today);
    const node = findNode(roots, UNASSIGNED_NODE_ID);
    check("the node exists", node !== null);
    check("it gained exactly our two unassigned people", (node?.total ?? 0) - baseline === 2, `${node?.total} vs baseline ${baseline}`);
    check("our people are listed on it, the assigned one is not",
      !!node && node.people.some((p) => p.name.includes("ללא-פיגור")) && node.people.some((p) => p.name.includes("ללא-נקי")) &&
      !node.people.some((p) => p.name.includes("משויך")));
    check("the overdue unassigned person is red on the node", !!node && node.people.find((p) => p.name.includes("ללא-פיגור"))?.status === "OVERDUE");
    const ourCenter = findNode(roots, center.id)!;
    check("it hangs under a CENTER root",
      before.concat(roots).length > 0 && roots.some((r) => r.kind === "CENTER" && findNode([r], UNASSIGNED_NODE_ID) !== null));
    check("...and last among that center's children",
      (() => { const c = roots.find((r) => findNode([r], UNASSIGNED_NODE_ID)); return c!.children[c!.children.length - 1].id === UNASSIGNED_NODE_ID; })());
    check("our own center (not first alphabetically) is not credited", findNode([ourCenter], UNASSIGNED_NODE_ID) === null || roots.findIndex((r) => r.id === center.id) === roots.findIndex((r) => findNode([r], UNASSIGNED_NODE_ID) !== null));
    const host = roots.find((r) => findNode([r], UNASSIGNED_NODE_ID) !== null)!;
    check("the hosting center's rollup includes the node's people",
      host.total >= (findNode([host], UNASSIGNED_NODE_ID)?.total ?? 0));
    check("the chooser offers the node", flattenWithPaths(roots).some((o) => o.id === UNASSIGNED_NODE_ID));
    check("narrowTree keeps it intact", (findNode(narrowTree(roots, "all"), UNASSIGNED_NODE_ID)?.total ?? -1) === node!.total);

    console.log("\n=== a scoped manager gets no node ===");
    const nodes = await prisma.orgNode.findMany();
    const scoped = visibilityFrom(nodes, { id: "x", name: "mgr", role: "MANAGER", grants: [{ nodeId: domain.id, level: "VIEW" }] });
    const theirRoots = await buildGapTree(scoped, today);
    check("no unassigned node in a domain-scoped tree", findNode(theirRoots, UNASSIGNED_NODE_ID) === null);

    console.log("\n=== the rendered dashboard ===");
    const cookie = `${SESSION_COOKIE}=${createSessionToken(admin.id)}`;
    const html = (await (await fetch(BASE + "/", { headers: { cookie } })).text()).replaceAll("<!-- -->", "");
    check("the tree shows the node with its chip", html.includes("ללא שיוך") && html.includes("לא משויכים"));
    check("the tile notes the unassigned count in parentheses",
      new RegExp(`\\(מתוכם ${node!.total} ללא שיוך\\)`).test(html), `expected (מתוכם ${node!.total} ללא שיוך)`);
  } finally {
    await cleanup();
    const residue = (await prisma.person.count({ where: { fullName: { startsWith: TAG } } })) +
      (await prisma.orgNode.count({ where: { name: { startsWith: TAG } } }));
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
