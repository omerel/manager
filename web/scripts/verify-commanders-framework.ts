/**
 * Verification for commanders-framework — the מפקדים framework that holds a
 * commander's card OUTSIDE the framework they command.
 *
 * The suite's centre of gravity is the access check: a team commander must not
 * reach their own card. Everything else (nesting, uniqueness, ordering, the
 * query audience) exists to keep that arrangement honest.
 *
 * Needs the dev server on :4321 for the rendered checks and the real form.
 *
 *   npx tsx scripts/verify-commanders-framework.ts
 */
import { prisma } from "@/lib/prisma";
import { visibilityFrom } from "@/lib/access";
import { buildGapTree, findNode } from "@/lib/gap-dashboard";
import { buildScopedTree, commandersNameClash } from "@/lib/org";
import { getEnrollableTeams, getEditableTeams } from "@/lib/people";
import { recipientsOf, commandedFrameworks } from "@/lib/queries";
import { validateOrgRows, type OrgMapping } from "@/lib/org-import";
import {
  CHILD_KINDS,
  PARENT_KINDS,
  bySiblingOrder,
  frameworkLabel,
  holdsPeople,
  KIND_ORDER,
  parentRefusal,
} from "@/lib/org-nesting";
import { resolveTeamByName } from "@/lib/hr-import";
import { assertCommandable } from "@/lib/commander";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

const TAG = "cmdverify";
const BASE = process.env.BASE_URL ?? "http://localhost:4321";

let failures = 0;
let checks = 0;
function check(label: string, ok: boolean, detail = "") {
  checks++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

/** Run an action that should be refused, and hand back the refusal. */
async function refusal(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    const r = await fn();
    // updateOrgNode returns its refusal rather than throwing
    const err = (r as { error?: string } | undefined)?.error;
    return err ?? null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

async function cleanup() {
  await prisma.person.deleteMany({ where: { fullName: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { username: { startsWith: TAG } } });
  // deepest-first, so no parent disappears before its children
  const doomed = await prisma.orgNode.findMany({ where: { name: { startsWith: TAG } }, select: { id: true, kind: true } });
  const depth = (k: string) => KIND_ORDER.indexOf(k as never);
  for (const n of doomed.sort((a, b) => depth(b.kind) - depth(a.kind))) {
    await prisma.orgNode.delete({ where: { id: n.id } }).catch(() => {});
  }
  await prisma.orgNode.deleteMany({ where: { name: { startsWith: TAG } } }).catch(() => {});
}

async function main() {
  await cleanup();

  const center = await prisma.orgNode.create({ data: { name: `${TAG} מרכז`, kind: "CENTER" } });
  const domain = await prisma.orgNode.create({ data: { name: `${TAG} תחום`, kind: "DOMAIN", parentId: center.id } });
  const section = await prisma.orgNode.create({ data: { name: `${TAG} מדור`, kind: "SECTION", parentId: domain.id } });
  const team = await prisma.orgNode.create({ data: { name: `${TAG} צוות`, kind: "TEAM", parentId: section.id } });

  const mkUser = (slug: string, role: "ADMIN" | "MANAGER", commandsNodeId: string | null, grants: { nodeId: string; level: "VIEW" | "EDIT" }[]) =>
    prisma.user.create({
      data: {
        name: `${TAG} ${slug}`, email: `${TAG}-${slug}@verify.invalid`, username: `${TAG}-${slug}`,
        passwordHash: hashPassword("x"), role, commandsNodeId,
        grants: { create: grants },
      },
      include: { grants: { select: { nodeId: true, level: true } } },
    });

  const admin = await mkUser("adm", "ADMIN", null, []);

  try {
    console.log("=== the nesting model says what it means ===");
    check("commanders may sit under center, domain and section",
      ["CENTER", "DOMAIN", "SECTION"].every((k) => PARENT_KINDS.COMMANDERS.includes(k as never)));
    check("...and never under a team", !PARENT_KINDS.COMMANDERS.includes("TEAM"));
    check("nothing may sit under a commanders framework", CHILD_KINDS.COMMANDERS.length === 0);
    check("a section holds teams AND a commanders framework",
      CHILD_KINDS.SECTION.includes("TEAM") && CHILD_KINDS.SECTION.includes("COMMANDERS"));
    check("commanders and teams hold people; the ladder ranks do not",
      holdsPeople("COMMANDERS") && holdsPeople("TEAM") && !holdsPeople("SECTION") && !holdsPeople("CENTER"));
    check("COMMANDERS sorts last, so a parent is always written first",
      KIND_ORDER[KIND_ORDER.length - 1] === "COMMANDERS");

    console.log("\n=== the parent rule, exercised on its own ===");
    // the rule is a pure function on purpose: a `"use server"` module can export
    // nothing but actions, so a rule that lived inside the action could only ever
    // be reached through a request. Both forms call exactly this.
    check("commanders under a section is allowed", parentRefusal("COMMANDERS", { kind: "SECTION" }) === null);
    check("...under a domain", parentRefusal("COMMANDERS", { kind: "DOMAIN" }) === null);
    check("...under a center", parentRefusal("COMMANDERS", { kind: "CENTER" }) === null);
    const underTeam = parentRefusal("COMMANDERS", { kind: "TEAM" });
    check("under a team it is refused, and the reason is the REASON",
      !!underTeam && underTeam.includes("מפקדי-משנה"), underTeam ?? "allowed!");
    const beneath = parentRefusal("TEAM", { kind: "COMMANDERS" });
    check("nothing may sit beneath one", !!beneath && beneath.includes("כרטיסים בלבד"), beneath ?? "allowed!");
    check("the ladder is unchanged: a team still needs a section",
      parentRefusal("TEAM", { kind: "SECTION" }) === null && parentRefusal("TEAM", { kind: "DOMAIN" }) !== null);

    const cmdSection = await prisma.orgNode.create({ data: { name: `${TAG} מפקדים מדור`, kind: "COMMANDERS", parentId: section.id } });
    const cmdDomain = await prisma.orgNode.create({ data: { name: `${TAG} מפקדים תחום`, kind: "COMMANDERS", parentId: domain.id } });

    console.log("\n=== the name is unique across the whole system ===");
    const taken = await commandersNameClash("COMMANDERS", `${TAG} מפקדים מדור`, null);
    check("a name another commanders framework holds is refused", !!taken && taken.includes("ייחודי"), taken ?? "free!");
    check("...and the refusal says WHERE the clash sits", !!taken && taken.includes(`${TAG} מדור`), taken ?? "");
    check("a free name is free", (await commandersNameClash("COMMANDERS", `${TAG} מפקדים חדש`, null)) === null);
    // the rename gate: a framework does not collide with itself
    check("renaming a framework to the name it already has is not a clash",
      (await commandersNameClash("COMMANDERS", `${TAG} מפקדים מדור`, cmdSection.id)) === null);
    check("...but renaming INTO another's name is",
      (await commandersNameClash("COMMANDERS", `${TAG} מפקדים מדור`, cmdDomain.id)) !== null);

    // the narrowness of the rule is the point: ordinary frameworks may go on
    // repeating names between branches, as they always have
    const twin = await prisma.orgNode.create({ data: { name: `${TAG} צוות`, kind: "TEAM", parentId: section.id } });
    check("two teams may still share a name — the rule does not reach them",
      (await prisma.orgNode.count({ where: { name: `${TAG} צוות` } })) === 2 &&
      (await commandersNameClash("TEAM", `${TAG} צוות`, null)) === null);
    await prisma.orgNode.delete({ where: { id: twin.id } });

    console.log("\n=== a commanders framework is never commanded ===");
    const cmdRefusal = await refusal(() => assertCommandable(cmdSection.id));
    check("appointing a commander over it is refused", !!cmdRefusal && cmdRefusal.includes("מפקד מסגרת האב"), cmdRefusal ?? "accepted!");
    check("a section may still be commanded", (await refusal(() => assertCommandable(section.id))) === null);

    console.log("\n=== the access arrangement — the whole point ===");
    const ramad = await mkUser("ramad", "MANAGER", section.id, [{ nodeId: section.id, level: "EDIT" }]);
    const teamLead = await mkUser("lead", "MANAGER", team.id, [{ nodeId: team.id, level: "EDIT" }]);

    // the team commander's OWN card, placed in the section's commanders framework
    const leadCard = await prisma.person.create({
      data: {
        firstName: TAG, lastName: "ראש-צוות", fullName: `${TAG} ראש-צוות`,
        recruitmentDate: new Date("2020-01-01"), placementDate: new Date("2020-01-01"), teamId: cmdSection.id,
      },
    });
    // an ordinary soldier, inside the team the lead commands
    await prisma.person.create({
      data: {
        firstName: TAG, lastName: "חייל", fullName: `${TAG} חייל`,
        recruitmentDate: new Date("2020-01-01"), placementDate: new Date("2020-01-01"), teamId: team.id,
      },
    });

    const nodes = await prisma.orgNode.findMany();
    const leadVis = visibilityFrom(nodes, { id: teamLead.id, name: teamLead.name, role: "MANAGER", grants: teamLead.grants });
    const ramadVis = visibilityFrom(nodes, { id: ramad.id, name: ramad.name, role: "MANAGER", grants: ramad.grants });

    check("the team commander cannot SEE the commanders framework", !leadVis.nodeIds.has(cmdSection.id));
    check("...cannot EDIT it", !leadVis.canEdit(cmdSection.id));
    check("...and holds no establishment authority over it", !leadVis.mayEstablishAt(cmdSection.id));
    check("the section commander sees it", ramadVis.nodeIds.has(cmdSection.id));
    check("...may edit it", ramadVis.canEdit(cmdSection.id));
    check("...and may enrol into it — a grant at section level", ramadVis.mayEstablishAt(cmdSection.id));
    check("the team commander still edits their own team", leadVis.canEdit(team.id));

    check("the section commander is offered it when enrolling",
      (await getEnrollableTeams(ramadVis)).some((t) => t.id === cmdSection.id));
    check("the team commander is offered nothing at all — no establishment authority",
      (await getEnrollableTeams(leadVis)).length === 0);
    check("the team commander's editable list excludes it",
      !(await getEditableTeams(leadVis)).some((t) => t.id === cmdSection.id));
    check("the picker labels it by full path",
      (await getEnrollableTeams(ramadVis)).find((t) => t.id === cmdSection.id)?.path.includes(`${TAG} מדור`) === true);

    console.log("\n=== the dashboard ===");
    const today = new Date();
    const ramadTree = await buildGapTree(ramadVis, today);
    const cmdNode = findNode(ramadTree, cmdSection.id);
    check("the commanders framework appears in the section commander's tree", cmdNode !== null);
    check("...listing the card it holds", !!cmdNode?.people.some((p) => p.name.includes("ראש-צוות")));
    check("...and carrying no commander label of its own", cmdNode?.commander === null);
    const sectionNode = findNode(ramadTree, section.id)!;
    check("its people roll up into the section", sectionNode.total >= 2);
    check("the commanders framework is FIRST among the section's children",
      sectionNode.children[0]?.id === cmdSection.id,
      sectionNode.children.map((c) => c.name).join(" | "));

    const leadTree = await buildGapTree(leadVis, today);
    check("the team commander's tree has no commanders framework in it", findNode(leadTree, cmdSection.id) === null);
    check("...and does not contain their own card",
      JSON.stringify(leadTree).includes("ראש-צוות") === false);
    check("...while it does contain their soldier", JSON.stringify(leadTree).includes("חייל"));

    const scoped = await buildScopedTree(ramadVis);
    check("the scoped tree pins it first too", scoped[0]?.children?.[0]?.id === cmdSection.id || scoped[0]?.id === cmdSection.id);

    console.log("\n=== queries never address it ===");
    const audience = await recipientsOf(section.id);
    check("the section's default audience is its teams, not its commanders framework",
      audience.some((r) => r.nodeId === team.id) && !audience.some((r) => r.nodeId === cmdSection.id),
      audience.map((r) => r.name).join(" | "));
    const domainAudience = await recipientsOf(domain.id);
    check("the domain's audience excludes its commanders framework too",
      !domainAudience.some((r) => r.nodeId === cmdDomain.id));
    check("the ‎@‎ picker cannot offer it either",
      !(await commandedFrameworks()).some((r) => r.nodeId === cmdSection.id));

    console.log("\n=== HR import resolves it by name ===");
    const allNodes = await prisma.orgNode.findMany();
    const hit = resolveTeamByName(ramadVis, allNodes, `${TAG} מפקדים מדור`);
    check("a row naming the commanders framework resolves to it", hit.ok && hit.teamId === cmdSection.id);
    const outOfScope = resolveTeamByName(leadVis, allNodes, `${TAG} מפקדים מדור`);
    check("...but not for someone who cannot edit it", !outOfScope.ok);

    console.log("\n=== the file importer ===");
    const mapping: OrgMapping = [
      { header: "שם", target: "name" },
      { header: "סוג", target: "kind" },
      { header: "אב", target: "parent" },
    ];
    const headers = ["שם", "סוג", "אב"];
    const good = validateOrgRows({ headers, rows: [
      ["מרכז ג", "מרכז", ""],
      ["תחום ג", "תחום", "מרכז ג"],
      ["מדור ג", "מדור", "תחום ג"],
      ["צוות ג", "צוות", "מדור ג"],
      ["מפקדים מדור ג", "מפקדים", "מדור ג"],
      ["מפקדים תחום ג", "מפקדים", "תחום ג"],
    ] }, mapping);
    check("a file with commanders frameworks validates clean", good.faults.length === 0, good.faults.map((f) => f.reason).join(" | "));
    check("...and every parent is planned before the row naming it", (() => {
      const seen = new Set<string>();
      for (const n of good.plan) {
        if (n.parentName && !seen.has(n.parentName)) return false;
        seen.add(n.name);
      }
      return true;
    })());

    const underTeamFile = validateOrgRows({ headers, rows: [
      ["מרכז ג", "מרכז", ""],
      ["תחום ג", "תחום", "מרכז ג"],
      ["מדור ג", "מדור", "תחום ג"],
      ["צוות ג", "צוות", "מדור ג"],
      ["מפקדים צוות ג", "מפקדים", "צוות ג"],
    ] }, mapping);
    check("a commanders framework under a team is a fault",
      underTeamFile.faults.some((f) => f.name === "מפקדים צוות ג"), underTeamFile.faults.map((f) => f.reason).join(" | "));
    check("...and nothing is planned", underTeamFile.plan.length === 0);

    const beneathFile = validateOrgRows({ headers, rows: [
      ["מרכז ג", "מרכז", ""],
      ["תחום ג", "תחום", "מרכז ג"],
      ["מדור ג", "מדור", "תחום ג"],
      ["מפקדים ג", "מפקדים", "מדור ג"],
      ["צוות ג", "צוות", "מפקדים ג"],
    ] }, mapping);
    check("a framework beneath a commanders framework is a fault",
      beneathFile.faults.some((f) => f.name === "צוות ג"), beneathFile.faults.map((f) => f.reason).join(" | "));

    const dupeFile = validateOrgRows({ headers, rows: [
      ["מרכז ג", "מרכז", ""],
      ["תחום א", "תחום", "מרכז ג"],
      ["תחום ב", "תחום", "מרכז ג"],
      ["מפקדים תשתיות", "מפקדים", "תחום א"],
      ["מפקדים תשתיות", "מפקדים", "תחום ב"],
    ] }, mapping);
    check("two commanders frameworks of the same name are a fault",
      dupeFile.faults.some((f) => f.reason.includes("ייחודי")), dupeFile.faults.map((f) => f.reason).join(" | "));
    check("...naming BOTH offending rows, not just the second",
      dupeFile.faults.filter((f) => f.reason.includes("ייחודי")).length === 2,
      `${dupeFile.faults.filter((f) => f.reason.includes("ייחודי")).length}`);

    const teamTwins = validateOrgRows({ headers, rows: [
      ["מרכז ג", "מרכז", ""],
      ["תחום ג", "תחום", "מרכז ג"],
      ["מדור א", "מדור", "תחום ג"],
      ["מדור ב", "מדור", "תחום ג"],
      ["צוות תשתיות", "צוות", "מדור א"],
      ["צוות תשתיות", "צוות", "מדור ב"],
    ] }, mapping);
    check("two TEAMS of the same name remain legal in a file",
      !teamTwins.faults.some((f) => f.reason.includes("ייחודי")), teamTwins.faults.map((f) => f.reason).join(" | "));

    console.log("\n=== presentation ===");
    check("a name already starting with «מפקדים» is not prefixed again",
      frameworkLabel("COMMANDERS", "מפקדים מדור 1") === "מפקדים מדור 1");
    check("...while a differently named one still says its kind",
      frameworkLabel("COMMANDERS", "סגל פיקודי") === "מפקדים: סגל פיקודי");
    check("ordinary frameworks are unaffected", frameworkLabel("TEAM", "אלפא") === "צוות: אלפא");
    check("the comparator pins commanders ahead of a team named «א»",
      bySiblingOrder({ kind: "COMMANDERS", name: "ת" }, { kind: "TEAM", name: "א" }) < 0);
    check("...and orders two teams by name as before",
      bySiblingOrder({ kind: "TEAM", name: "ב" }, { kind: "TEAM", name: "א" }) > 0);

    console.log("\n=== through the real browser form ===");
    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: SESSION_COOKIE, value: createSessionToken(admin.id), domain: "localhost", path: "/" }]);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/hierarchy`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('input[name="name"]');
    await page.fill('input[name="name"]', `${TAG} מפקדים מרכז`);
    await page.selectOption('select[name="kind"]', "COMMANDERS");
    await page.selectOption('select[name="parentId"]', center.id);
    await page.click('button:has-text("הוסף מסגרת")');
    await page.waitForTimeout(2500);
    const toast = page.locator("[data-action-toast]");
    check("adding through the form raises no error",
      (await toast.count()) === 0, (await toast.count()) ? (await toast.innerText()).slice(0, 160) : "");
    const viaForm = await prisma.orgNode.findFirst({ where: { name: `${TAG} מפקדים מרכז` } });
    check("the form actually created it under the center", viaForm?.kind === "COMMANDERS" && viaForm?.parentId === center.id);

    // and the refusal reaches the screen rather than an error page
    await page.goto(`${BASE}/hierarchy`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('input[name="name"]');
    await page.fill('input[name="name"]', `${TAG} מפקדים מרכז`);
    await page.selectOption('select[name="kind"]', "COMMANDERS");
    await page.selectOption('select[name="parentId"]', domain.id);
    await page.click('button:has-text("הוסף מסגרת")');
    await page.waitForTimeout(2500);
    const dupeToast = page.locator("[data-action-toast]");
    check("a duplicate name surfaces as a toast, not an error page",
      (await dupeToast.count()) > 0 && (await dupeToast.innerText()).includes("ייחודי"),
      (await dupeToast.count()) ? (await dupeToast.innerText()).slice(0, 160) : "no toast");
    check("and nothing was created by the refused attempt",
      (await prisma.orgNode.count({ where: { name: `${TAG} מפקדים מרכז` } })) === 1);

    // and the nesting refusal reaches the screen the same way
    await page.goto(`${BASE}/hierarchy`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('input[name="name"]');
    await page.fill('input[name="name"]', `${TAG} מפקדים צוות`);
    await page.selectOption('select[name="kind"]', "COMMANDERS");
    await page.selectOption('select[name="parentId"]', team.id);
    await page.click('button:has-text("הוסף מסגרת")');
    await page.waitForTimeout(2500);
    const teamToast = page.locator("[data-action-toast]");
    check("under a team the form refuses, on screen, with the reason",
      (await teamToast.count()) > 0 && (await teamToast.innerText()).includes("מפקדי-משנה"),
      (await teamToast.count()) ? (await teamToast.innerText()).slice(0, 160) : "no toast");
    check("and nothing was created under the team",
      (await prisma.orgNode.count({ where: { name: `${TAG} מפקדים צוות` } })) === 0);

    const html = await page.content();
    check("the hierarchy screen offers «מפקדים» as a kind", html.includes('value="COMMANDERS"'));
    await browser.close();

    console.log("\n=== the rendered dashboard ===");
    const cookie = `${SESSION_COOKIE}=${createSessionToken(ramad.id)}`;
    const dash = (await (await fetch(BASE + "/", { headers: { cookie } })).text()).replaceAll("<!-- -->", "");
    check("the section commander's dashboard shows the commanders framework", dash.includes(`${TAG} מפקדים מדור`));
    check("...with the card it holds", dash.includes("ראש-צוות"));

    const leadCookie = `${SESSION_COOKIE}=${createSessionToken(teamLead.id)}`;
    const leadDash = (await (await fetch(BASE + "/", { headers: { cookie: leadCookie } })).text()).replaceAll("<!-- -->", "");
    check("the team commander's dashboard does NOT show their own card", !leadDash.includes("ראש-צוות"));
    check("...and does show their soldier", leadDash.includes("חייל"));

    // the card is reachable by the section commander and refused to the lead
    const cardRes = await fetch(`${BASE}/people/${leadCard.id}`, { headers: { cookie: leadCookie }, redirect: "manual" });
    check("the team commander cannot open their own card", cardRes.status !== 200, `HTTP ${cardRes.status}`);
    const okRes = await fetch(`${BASE}/people/${leadCard.id}`, { headers: { cookie }, redirect: "manual" });
    check("the section commander can", okRes.status === 200, `HTTP ${okRes.status}`);
  } finally {
    await cleanup();
    const residue =
      (await prisma.person.count({ where: { fullName: { startsWith: TAG } } })) +
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
