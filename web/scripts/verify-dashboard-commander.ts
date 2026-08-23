/**
 * Verification for dashboard-tree-commander — the commander's name rides the
 * gap tree and surfaces as a label on the dashboard.
 *
 * Needs the dev server on :4321 for the rendered-HTML checks.
 *
 *   npx tsx scripts/verify-dashboard-commander.ts
 */
import { prisma } from "@/lib/prisma";
import { computeVisibility } from "@/lib/access";
import { buildGapTree, findNode, narrowTree } from "@/lib/gap-dashboard";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

const TAG = "dcverify";
const BASE = process.env.BASE_URL ?? "http://localhost:4321";

let failures = 0;
let checks = 0;
function check(label: string, ok: boolean, detail = "") {
  checks++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function cleanup() {
  await prisma.user.deleteMany({ where: { username: { startsWith: TAG } } });
  await prisma.orgNode.deleteMany({ where: { name: { startsWith: TAG } } });
}

async function main() {
  await cleanup();

  // one commanded team, one uncommanded, and an admin who commands the first
  const center = await prisma.orgNode.create({ data: { name: `${TAG} מרכז`, kind: "CENTER" } });
  const commanded = await prisma.orgNode.create({ data: { name: `${TAG} צוות מפוקד`, kind: "TEAM", parentId: center.id } });
  const bare = await prisma.orgNode.create({ data: { name: `${TAG} צוות חופשי`, kind: "TEAM", parentId: center.id } });
  const admin = await prisma.user.create({
    data: {
      name: `${TAG} רס״ן בודק`, email: `${TAG}@verify.local`, username: `${TAG}-adm`,
      passwordHash: hashPassword("x"), role: "ADMIN", commandsNodeId: commanded.id,
    },
  });

  try {
    console.log("=== buildGapTree stamps the commander on the right node, and only there ===");
    const vis = await computeVisibility({ id: admin.id, name: admin.name, role: "ADMIN", grants: [] });
    const roots = await buildGapTree(vis, new Date());
    const hit = findNode(roots, commanded.id)!;
    const miss = findNode(roots, bare.id)!;
    check("the commanded team carries the commander's name", hit.commander === admin.name, `${hit.commander}`);
    check("the uncommanded team carries null", miss.commander === null);
    check("the parent centre is not credited with its child's commander", findNode(roots, center.id)!.commander === null);

    console.log("\n=== the name survives every narrowing ===");
    for (const kind of ["all", "overdue", "approaching"] as const) {
      const narrowed = narrowTree(roots, kind);
      check(`narrowTree(${kind}) preserves the commander`, findNode(narrowed, commanded.id)!.commander === admin.name);
    }

    console.log("\n=== the label reaches the rendered dashboard ===");
    const cookie = `${SESSION_COOKIE}=${createSessionToken(admin.id)}`;
    const res = await fetch(BASE + "/", { headers: { cookie }, redirect: "manual" });
    const html = res.status === 200 ? await res.text() : "";
    check("the dashboard answers a signed-in fetch", res.status === 200, `HTTP ${res.status}`);
    // React separates adjacent text nodes with <!-- -->, so match through it;
    // and count only OUR label — the running database may hold real commanders
    const label = new RegExp(`מפקד: (<!-- -->)?${TAG}`, "g");
    const ours = (html.match(label) ?? []).length;
    check("the commanded team is labelled with its commander", ours >= 1);
    check("the label appears exactly once — the bare team got none", ours === 1, `${ours} labels`);
  } finally {
    await cleanup();
    const users = await prisma.user.count({ where: { username: { startsWith: TAG } } });
    const nodes = await prisma.orgNode.count({ where: { name: { startsWith: TAG } } });
    check("no fixtures left behind", users === 0 && nodes === 0, `${users} users, ${nodes} frameworks`);
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
