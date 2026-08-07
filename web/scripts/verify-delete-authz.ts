/**
 * Verification for admin-delete-person-and-plan (tasks 6.3, 6.5, 6.7) and for
 * person-lifecycle-authority (tasks 4.1-4.3).
 *
 * Runs against the dev server. Creates its own throwaway users and people,
 * removes them at the end, and touches nothing else.
 *
 * The authorization check is a replay, not a reconstruction: it captures the
 * real POST the admin's delete button makes — action id, headers and body — and
 * re-sends it with a manager's session cookie against a different person. That
 * is the request an attacker would forge, and the only thing that stands
 * between it and the database is requireAdmin().
 *
 *   npx tsx --env-file=.env scripts/verify-delete-authz.ts
 */
import { readFile } from "fs/promises";
import { readLabeledFields } from "./form-labels";
import { chromium, type BrowserContext } from "playwright";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/password";
import { visibilityFrom, type SessionUser } from "../src/lib/access";
import { getEnrollableTeams, getEditableTeams, getVisiblePerson } from "../src/lib/people";

const BASE = process.env.BASE_URL ?? "http://localhost:4321";
const PASSWORD = "verify-delete-1234";

let failures = 0;
let checksRun = 0;
function check(label: string, ok: boolean, detail = "") {
  checksRun++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function login(ctx: BrowserContext, username: string) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="identifier"]', username);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"], form button');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });
  return page;
}

/**
 * The core labels PersonFormFields actually renders, scraped from its source.
 * Deliberately not imported from CORE_FIELDS: a check that reads the same
 * constant the page reads would pass no matter how wrong both were.
 */
async function readFormLabels(): Promise<Set<string>> {
  // extraction is shared (scripts/form-labels.ts); this suite wants the field
  // name as the card-schema page lists it, so every parenthetical goes
  const labels = new Set<string>();
  for (const { label } of await readLabeledFields()) {
    if (label.startsWith("גיל")) continue; // derived, not a field — asserted separately
    labels.add(label.replace(/\s*\(.*\)\s*$/, ""));
  }
  return labels;
}

async function makePerson(name: string) {
  const team = await prisma.orgNode.findFirst({ where: { kind: "TEAM" } });
  return prisma.person.create({
    data: {
      firstName: "בדיקה",
      lastName: name,
      fullName: `בדיקה ${name}`,
      birthDate: new Date("1995-01-01"),
      recruitmentDate: new Date("2023-01-01"),
      placementDate: new Date("2023-01-01"),
      teamId: team?.id ?? null,
    },
  });
}


/**
 * The establishment rule, recomputed from scratch: a team may be enrolled into
 * when the team itself or any ancestor carries an EDIT grant AND that node is a
 * section, domain or centre. Walks UP from each team; `visibilityFrom` walks
 * DOWN from each grant. Two directions, one answer — which is the point: a
 * check that reused the implementation's walk could only agree with itself.
 */
async function expectedEnrollable(grants: { nodeId: string; level: string }[]): Promise<Set<string>> {
  const nodes = await prisma.orgNode.findMany();
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const grantAt = new Map(grants.map((g) => [g.nodeId, g.level]));
  const out = new Set<string>();
  for (const team of nodes.filter((n) => n.kind === "TEAM")) {
    let cur: (typeof nodes)[number] | undefined = team;
    while (cur) {
      const senior = cur.kind === "SECTION" || cur.kind === "DOMAIN" || cur.kind === "CENTER";
      if (senior && grantAt.get(cur.id) === "EDIT") { out.add(team.id); break; }
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
  }
  return out;
}

/** The rule and its readers, without a browser. */
async function checkThePredicate(section: string, team: string) {
  console.log("\n=== 4.1 / 4.2 the rule, and the picker that must agree with it ===");
  const nodes = await prisma.orgNode.findMany();
  const asUser = (grants: { nodeId: string; level: "EDIT" | "VIEW" }[], role: "MANAGER" | "ADMIN" = "MANAGER"): SessionUser =>
    ({ id: "synthetic", name: "synthetic", role, grants } as SessionUser);

  const cases: { label: string; user: SessionUser; establishesTeam: boolean }[] = [
    { label: "EDIT on the section", user: asUser([{ nodeId: section, level: "EDIT" }]), establishesTeam: true },
    { label: "EDIT on the team alone", user: asUser([{ nodeId: team, level: "EDIT" }]), establishesTeam: false },
    { label: "VIEW on the section", user: asUser([{ nodeId: section, level: "VIEW" }]), establishesTeam: false },
    { label: "no grants at all", user: asUser([]), establishesTeam: false },
    { label: "the admin", user: asUser([], "ADMIN"), establishesTeam: true },
  ];

  for (const c of cases) {
    const v = visibilityFrom(nodes, c.user);
    check(`${c.label}: mayEstablishAt(team) is ${c.establishesTeam}`, v.mayEstablishAt(team) === c.establishesTeam);
    // the two readers must not drift: what the picker offers is exactly what
    // the guard would accept, checked against the independent walk
    const expected = c.user.role === "ADMIN"
      ? new Set(nodes.filter((n) => n.kind === "TEAM").map((n) => n.id))
      : await expectedEnrollable(c.user.grants);
    const offered = new Set((await getEnrollableTeams(v)).map((t) => t.id));
    const same = offered.size === expected.size && [...expected].every((id) => offered.has(id));
    check(`${c.label}: the picker offers exactly the teams the guard accepts`, same, `${offered.size} offered, ${expected.size} expected`);
    for (const id of offered) {
      if (!v.mayEstablishAt(id)) check(`${c.label}: offered a team the guard refuses`, false, id);
    }
  }

  // the split itself: a team-level grant still edits, it just does not enrol
  const teamOnly = visibilityFrom(nodes, asUser([{ nodeId: team, level: "EDIT" }]));
  check("a team-level grant still edits that team", teamOnly.canEdit(team));
  check("...and getEditableTeams still offers it", (await getEditableTeams(teamOnly)).some((t) => t.id === team));
  check("...while getEnrollableTeams does not", !(await getEnrollableTeams(teamOnly)).some((t) => t.id === team));

  // a person with no team has no framework above them to derive authority from
  const stray = await prisma.person.create({
    data: {
      firstName: "בדיקה", lastName: "ללא שיוך", fullName: "בדיקה ללא שיוך",
      birthDate: new Date("1995-01-01"), recruitmentDate: new Date("2023-01-01"),
      placementDate: new Date("2023-01-01"), teamId: null,
    },
  });
  try {
    const asAdmin = visibilityFrom(nodes, asUser([], "ADMIN"));
    const asSection = visibilityFrom(nodes, asUser([{ nodeId: section, level: "EDIT" }]));
    check("an unassigned person is deletable by the admin", (await getVisiblePerson(stray.id, asAdmin))?.canDelete === true);
    check("...and invisible to a section commander, let alone deletable", (await getVisiblePerson(stray.id, asSection)) === null);
  } finally {
    await prisma.person.delete({ where: { id: stray.id } });
  }

  // the whole subtree, not just the level below
  const centre = nodes.find((n) => n.kind === "CENTER" && nodes.some((s) => s.parentId === n.id));
  if (centre) {
    const fromCentre = visibilityFrom(nodes, asUser([{ nodeId: centre.id, level: "EDIT" }]));
    const beneath = (await expectedEnrollable([{ nodeId: centre.id, level: "EDIT" }])).size;
    check("a centre grant reaches every team beneath it", (await getEnrollableTeams(fromCentre)).length === beneath, `${beneath} teams`);
  }
}

async function main() {
  // throwaway accounts with a known password; both removed in finally
  const adminUser = await prisma.user.create({
    data: { username: "verify.admin", email: "verify.admin@example.invalid", name: "בודק אדמין", role: "ADMIN", passwordHash: hashPassword(PASSWORD) },
  });
  const managerUser = await prisma.user.create({
    data: { username: "verify.manager", email: "verify.manager@example.invalid", name: "בודק מנהל", role: "MANAGER", passwordHash: hashPassword(PASSWORD) },
  });
  const victim = await makePerson("קורבן");
  const survivor = await makePerson("שורד");

  // the two commanders the rule distinguishes, on a real section and a real
  // team beneath it, plus a person sitting on that team so both can see them
  const team = await prisma.orgNode.findFirstOrThrow({ where: { kind: "TEAM", parent: { kind: "SECTION" } }, include: { parent: true } });
  const section = team.parent!;
  const sectionUser = await prisma.user.create({
    data: {
      username: "verify.section", email: "verify.section@example.invalid", name: "בודק ראש מדור", role: "MANAGER",
      passwordHash: hashPassword(PASSWORD), grants: { create: { nodeId: section.id, level: "EDIT" } },
    },
  });
  const teamUser = await prisma.user.create({
    data: {
      username: "verify.team", email: "verify.team@example.invalid", name: "בודק ראש צוות", role: "MANAGER",
      passwordHash: hashPassword(PASSWORD), grants: { create: { nodeId: team.id, level: "EDIT" } },
    },
  });
  const onTeam = await prisma.person.create({
    data: {
      firstName: "בדיקה", lastName: "צוותי", fullName: "בדיקה צוותי",
      birthDate: new Date("1995-01-01"), recruitmentDate: new Date("2023-01-01"),
      placementDate: new Date("2023-01-01"), teamId: team.id,
    },
  });

  await checkThePredicate(section.id, team.id);

  const browser = await chromium.launch();
  let crashed: unknown = null;
  try {
    // ---- admin: the control exists, and deleting works end to end ----
    console.log("\n=== 6.5 admin sees the control and the delete works ===");
    const adminCtx = await browser.newContext();
    const admin = await login(adminCtx, "verify.admin");
    await admin.goto(`${BASE}/people`);
    const victimRow = admin.locator("tr", { hasText: victim.fullName });
    await victimRow.waitFor({ timeout: 15000 });
    const deleteBtn = victimRow.getByTitle(`מחק את ${victim.fullName}`);
    check("delete control is rendered for the admin", (await deleteBtn.count()) === 1);

    // capture the real server-action request the confirm button sends
    let captured: { url: string; headers: Record<string, string>; body: string } | null = null;
    admin.on("request", (req) => {
      if (req.method() === "POST" && req.headers()["next-action"]) {
        captured = { url: req.url(), headers: req.headers(), body: req.postData() ?? "" };
      }
    });

    await deleteBtn.click();
    const dialog = admin.getByRole("dialog");
    await dialog.waitFor({ timeout: 5000 });
    check("confirmation names the person", (await dialog.textContent())?.includes(victim.fullName) === true);
    check(
      "a person with no history is described, not shown zeroes",
      (await dialog.textContent())?.includes("אין היסטוריה במערכת") === true,
    );
    await dialog.getByRole("button", { name: "מחק את האיש וכל הרשום עליו" }).click();
    await admin.waitForTimeout(2500);

    check("the person is gone from the database", (await prisma.person.count({ where: { id: victim.id } })) === 0);
    await admin.reload();
    check("and gone from the list", (await admin.locator("tr", { hasText: victim.fullName }).count()) === 0);

    await admin.goto(`${BASE}/plans`);
    check("plans page shows a delete control for the admin", (await admin.getByTitle(/^מחק את /).count()) > 0);

    // ---- 6.7: the card-schema page names the fields the form renders ----
    console.log("\n=== 6.7 the card-schema page names the real core fields ===");
    await admin.goto(`${BASE}/people/card-schema`);
    const schemaText = (await admin.locator("body").textContent()) ?? "";
    // read from the form component, so the check cannot pass by agreeing with itself
    const formLabels = [...(await readFormLabels())];
    for (const label of formLabels) {
      check(`names "${label}"`, schemaText.includes(label));
    }
    check("mentions the derived age", schemaText.includes("הגיל"));
    check("does not still say the stale ״סיום שירות״ shorthand", !schemaText.includes("סטטוס · סיום שירות"));

    // ---- manager: no control, and the forged request is refused ----
    console.log("\n=== 6.3 / 6.5 a manager cannot delete ===");
    const mgrCtx = await browser.newContext();
    const mgr = await login(mgrCtx, "verify.manager");
    await mgr.goto(`${BASE}/people`);
    await mgr.waitForTimeout(500);
    check("no delete control on the people list", (await mgr.getByTitle(/^מחק את /).count()) === 0);
    await mgr.goto(`${BASE}/plans`);
    await mgr.waitForTimeout(500);
    check("no delete control on the plans list", (await mgr.getByTitle(/^מחק את /).count()) === 0);

    if (!captured) {
      check("captured the admin's delete request for replay", false);
    } else {
      const cap = captured as { url: string; headers: Record<string, string>; body: string };
      // same action, same shape, a different person, a manager's cookies
      const body = cap.body.replace(victim.id, survivor.id);
      check("the replay body targets the surviving person", body.includes(survivor.id));
      const res = await mgrCtx.request.post(cap.url, {
        headers: {
          "next-action": cap.headers["next-action"],
          "content-type": cap.headers["content-type"] ?? "text/plain;charset=UTF-8",
        },
        data: body,
      });
      const stillThere = (await prisma.person.count({ where: { id: survivor.id } })) === 1;
      check("the forged delete did not remove the person", stillThere, `HTTP ${res.status()}`);
      check("their plan copies and records are untouched", stillThere);
    }

    // ---- the establishment split, end to end ----
    console.log("\n=== 4.1 / 4.3 a section commander enrols and removes; a team commander does neither ===");
    const secCtx = await browser.newContext();
    const sec = await login(secCtx, "verify.section");
    await sec.goto(`${BASE}/people`);
    check("section commander is offered ״עובד חדש״", (await sec.getByRole("link", { name: "עובד חדש" }).count()) === 1);
    check("section commander sees a delete control beneath them", (await sec.getByTitle(`מחק את ${onTeam.fullName}`).count()) === 1);

    // capture the real create request while a section commander enrols someone
    let createReq: { url: string; headers: Record<string, string>; body: string } | null = null;
    sec.on("request", (req) => {
      if (req.method() === "POST" && req.headers()["next-action"]) {
        createReq = { url: req.url(), headers: req.headers(), body: req.postData() ?? "" };
      }
    });
    await sec.goto(`${BASE}/people/new`);
    const picker = sec.locator('select[name="teamId"]');
    check("the picker offers the section commander a team", (await picker.locator("option").count()) > 0);
    await sec.fill('input[name="firstName"]', "בדיקה");
    await sec.fill('input[name="lastName"]', "מהטופס");
    await sec.fill('input[name="birthDate"]', "01/01/1995");
    await sec.fill('input[name="recruitmentDate"]', "01/01/2023");
    await sec.fill('input[name="placementDate"]', "01/01/2023");
    await sec.getByRole("button", { name: "צור עובד" }).click();
    await sec.waitForTimeout(2500);
    const enrolled = await prisma.person.findFirst({ where: { lastName: "מהטופס" } });
    check("the section commander's create succeeded", enrolled !== null);

    // ---- the team commander: edits, but neither enrols nor removes ----
    const teamCtx = await browser.newContext();
    const tm = await login(teamCtx, "verify.team");
    await tm.goto(`${BASE}/people`);
    await tm.locator("tr", { hasText: onTeam.fullName }).waitFor({ timeout: 15000 });
    check("team commander is not offered ״עובד חדש״", (await tm.getByRole("link", { name: "עובד חדש" }).count()) === 0);
    check("team commander sees no delete control at all", (await tm.getByTitle(/^מחק את /).count()) === 0);

    await tm.goto(`${BASE}/people/new`);
    const newPageText = (await tm.locator("body").textContent()) ?? "";
    check("the new-person page refuses rather than showing an empty picker", newPageText.includes("מדור ומעלה"));
    check("...and renders no team picker", (await tm.locator('select[name="teamId"]').count()) === 0);

    // the half of the request that must NOT change
    await tm.goto(`${BASE}/people/${onTeam.id}`);
    const cardText = (await tm.locator("body").textContent()) ?? "";
    check("the team commander still edits their people", !cardText.includes("צפייה בלבד"));
    check("...and is offered the edit control", (await tm.getByRole("link", { name: /עריכ/ }).count()) > 0);

    // ---- forged requests, the only thing the guards actually stand against ----
    if (!createReq) {
      check("captured the section commander's create request for replay", false);
    } else {
      const cr = createReq as { url: string; headers: Record<string, string>; body: string };
      const before = await prisma.person.count({ where: { lastName: "מהטופס" } });
      const res = await teamCtx.request.post(cr.url, {
        headers: { "next-action": cr.headers["next-action"], "content-type": cr.headers["content-type"] ?? "text/plain;charset=UTF-8" },
        data: cr.body,
      });
      const after = await prisma.person.count({ where: { lastName: "מהטופס" } });
      check("the forged create by a team commander created nobody", after === before, `HTTP ${res.status()}, ${before} → ${after}`);
    }

    if (captured) {
      const cap2 = captured as { url: string; headers: Record<string, string>; body: string };
      // their OWN person, on their OWN team — refused for the rank, not the reach
      const res = await teamCtx.request.post(cap2.url, {
        headers: { "next-action": cap2.headers["next-action"], "content-type": cap2.headers["content-type"] ?? "text/plain;charset=UTF-8" },
        data: cap2.body.replace(victim.id, onTeam.id),
      });
      const survived = (await prisma.person.count({ where: { id: onTeam.id } })) === 1;
      check("the forged delete by a team commander, of a person on their own team, was refused", survived, `HTTP ${res.status()}`);
    }

    // and the section commander's delete really works, on the person they enrolled
    if (enrolled) {
      await sec.goto(`${BASE}/people`);
      const btn = sec.getByTitle(`מחק את ${enrolled.fullName}`);
      check("section commander sees the delete control for their enrolee", (await btn.count()) === 1);
      await btn.click();
      const dlg2 = sec.getByRole("dialog");
      await dlg2.waitFor({ timeout: 5000 });
      await dlg2.getByRole("button", { name: "מחק את האיש וכל הרשום עליו" }).click();
      await sec.waitForTimeout(2500);
      check("the section commander's delete removed them", (await prisma.person.count({ where: { id: enrolled.id } })) === 0);
    }

    const plansLeft = await prisma.careerPlan.count({ where: { isTemplate: true } });
    check("no template was deleted during the run", plansLeft === 4, `${plansLeft} templates`);
  } catch (e) {
    crashed = e;
  } finally {
    await browser.close();
    await prisma.person.deleteMany({ where: { OR: [{ id: { in: [victim.id, survivor.id, onTeam.id] } }, { lastName: "מהטופס" }] } });
    await prisma.user.deleteMany({ where: { id: { in: [adminUser.id, managerUser.id, sectionUser.id, teamUser.id] } } });
    if (crashed) {
      // never let cleanup swallow the reason: a run that threw is not a pass
      console.error("\nRUN CRASHED:", crashed instanceof Error ? crashed.stack : crashed);
    }
    const clean = !crashed && failures === 0 && checksRun > 0;
    console.log(clean ? `\nall ${checksRun} checks passed` : `\nFAILED — ${checksRun} checks ran, ${failures} failed${crashed ? ", run crashed" : ""}`);
    await prisma.$disconnect();
    process.exit(clean ? 0 : 1);
  }
}

main();
