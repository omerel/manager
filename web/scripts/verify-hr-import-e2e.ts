/**
 * Verification for hr-import-people — the page, through a real browser.
 *
 * The engine suite proves classification; this half proves the page CALLS it:
 * the role gate on /hr, upload → preview, a mapping correction reclassifying,
 * one approval executing in the background, the report — and the stale-preview
 * guard, proven by racing a create between preview and approval.
 *
 * Requires the dev server (BASE_URL, default http://localhost:4321).
 *
 *   npx tsx scripts/verify-hr-import-e2e.ts
 */
import { writeFileSync, rmSync } from "fs";
import { chromium, type Browser, type Page } from "playwright";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { normalizeIdentity } from "@/lib/identity-keys";

const BASE = process.env.BASE_URL ?? "http://localhost:4321";
const TAG = "hrie2e";
const MAIL = `@${TAG}.invalid`;
const PASSWORD = "verify-hr-import-1";
const CSV = `/tmp/claude-1000/-home-omer-Projects-manager/de9743d3-ec83-43e1-ba9e-acb0b0b65de6/scratchpad/${TAG}.csv`;

let failures = 0;
let checks = 0;
function check(label: string, ok: boolean, detail = "") {
  checks++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function cleanup() {
  await prisma.agentRun.deleteMany({ where: { kind: "HR_IMPORT", user: { email: { endsWith: MAIL } } } });
  await prisma.person.deleteMany({ where: { fullName: { contains: TAG } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: MAIL } } });
  await prisma.orgNode.deleteMany({ where: { name: { startsWith: TAG } } });
  rmSync(CSV, { force: true });
}

async function signIn(browser: Browser, username: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="identifier"]', username);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"], form button');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
  return page;
}

async function main() {
  await cleanup();

  const center = await prisma.orgNode.create({ data: { name: `${TAG} מרכז`, kind: "CENTER" } });
  const domain = await prisma.orgNode.create({ data: { name: `${TAG} תחום`, kind: "DOMAIN", parentId: center.id } });
  const sec = await prisma.orgNode.create({ data: { name: `${TAG} מדור`, kind: "SECTION", parentId: domain.id } });
  const team = await prisma.orgNode.create({ data: { name: `${TAG} צוות`, kind: "TEAM", parentId: sec.id } });

  const mkUser = (h: string, role: "HR" | "MANAGER" | "ADMIN", grant?: string) =>
    prisma.user.create({
      data: {
        name: `${TAG}-${h}`, email: `${h}${MAIL}`, username: `${TAG}-${h}`,
        passwordHash: hashPassword(PASSWORD), role,
        grants: grant ? { create: [{ nodeId: grant, level: "EDIT" }] } : undefined,
      },
    });
  await mkUser("hr", "HR", sec.id); // section-level edit: scope + establishment
  await mkUser("mgr", "MANAGER", sec.id);
  await mkUser("adm", "ADMIN");

  // recognised headers + one foreign column the agent may or may not map — the
  // classification must not depend on it either way
  writeFileSync(
    CSV,
    "﻿" + [
      "שם פרטי,שם משפחה,תעודת זהות,תאריך לידה,תאריך גיוס,מסגרת,הערות פנימיות",
      `אורי,${TAG},700000001,05/03/1991,01/06/2020,${TAG} צוות,שטויות`,
      `דנה,${TAG},700000002,06/04/1992,01/07/2021,${TAG} צוות,עוד`,
      `רון,${TAG},700000003,07/05/1993,32/13/2021,${TAG} צוות,שגוי`,
    ].join("\n"),
  );

  const browser = await chromium.launch();
  try {
    console.log("\n=== the role gate ===");
    const mgr = await signIn(browser, `${TAG}-mgr`);
    await mgr.goto(`${BASE}/hr`);
    check("a Manager is refused the page", (await mgr.locator("body").innerText()).includes("404") ||
      !(await mgr.locator("body").innerText()).includes("עמוד משא״ן"), "not found for them");
    check("and has no nav item", !(await mgr.locator('nav').innerText()).includes("משא״ן"));
    const adm = await signIn(browser, `${TAG}-adm`);
    await adm.goto(`${BASE}/hr`);
    // flipped by user decision: the Admin has authority over everything, the
    // page included — only a Manager stays out
    check("an Admin gets the page — authority over everything", (await adm.locator("body").innerText()).includes("העלאת קובץ"));
    check("and the nav item with it", (await adm.locator("nav").innerText()).includes("משא״ן"));

    console.log("\n=== upload → preview ===");
    const hr = await signIn(browser, `${TAG}-hr`);
    check("the HR user has the nav item", (await hr.locator("nav").innerText()).includes("משא״ן"));
    await hr.goto(`${BASE}/hr`);
    await hr.setInputFiles('input[type="file"]', CSV);
    await hr.locator('button:text("קרא ובנה תצוגה מקדימה")').click();
    // the foreign column sends the mapping to a REAL model — this legitimately
    // takes a minute-plus; waiting a fixed 4s read the page mid-action
    await hr.locator('h2:text("מה יקרה")').waitFor({ timeout: 240_000 });
    const preview = (await hr.locator("body").innerText()).replace(/\s+/g, " ");
    check("the preview appeared (agent mapping included)", preview.includes("מה יקרה"));
    check("two clean rows will create", preview.includes("2 ייווצרו"), preview.includes("2 ייווצרו") ? "2" : "WRONG COUNT");
    check("the impossible date is an error naming the value — no format explains 32/13", preview.includes("32/13/2021"));
    check("nothing was written yet", (await prisma.person.count({ where: { fullName: { contains: TAG } } })) === 0,
      "the registry is untouched before approval");

    console.log("\n=== a mapping correction reclassifies ===");
    // break the mapping by hand: point תעודת זהות at ignore → identity vanishes
    const tzCol = 2;
    await hr.locator(`select[name="col_${tzCol}"]`).selectOption("ignore");
    await hr.locator('button:text("חשב מחדש עם המיפוי המתוקן")').click();
    await hr.locator('h2:text("מה יקרה")').waitFor({ timeout: 60_000 });
    check("the recomputed preview still stands", (await hr.locator("body").innerText()).includes("מה יקרה"));
    // and back. The h2 exists CONTINUOUSLY across recomputes, so waiting on it
    // waits for nothing — the first draft of this test raced its own remap and
    // the classification absorbed the "stale" person at preview time, which is
    // correct behaviour but not the write-time guard under test. Wait on the
    // STORED state instead: the remap is done when the row says so.
    const defs = await prisma.personFieldDef.findFirstOrThrow({ where: { label: "תעודת זהות" }, select: { id: true } });
    await hr.locator(`select[name="col_${tzCol}"]`).selectOption(`custom:${defs.id}`);
    await hr.locator('button:text("חשב מחדש עם המיפוי המתוקן")').click();
    for (let i = 0; i < 60; i++) {
      await hr.waitForTimeout(1000);
      const row = await prisma.agentRun.findFirst({ where: { kind: "HR_IMPORT", user: { email: `hr${MAIL}` } } });
      const st = row?.output ? JSON.parse(row.output) : null;
      if (st?.stage === "preview" && st.mapping?.[tzCol]?.target === `custom:${defs.id}`) break;
    }
    await hr.reload();
    await hr.locator('h2:text("מה יקרה")').waitFor({ timeout: 30_000 });

    console.log("\n=== the stale-preview race, then one approval ===");
    // between preview and approval, somebody else creates אורי with the same ת״ז
    const tzDefId = defs.id;
    await prisma.person.create({
      data: {
        firstName: "אורי", lastName: `${TAG}-race`, fullName: `אורי ${TAG}-race`,
        recruitmentDate: new Date("2020-01-01"), placementDate: new Date("2020-01-01"),
        teamId: team.id,
        fieldValues: { create: [{ fieldDefId: tzDefId, value: "700000001", order: 0 }] },
      },
    });
    await hr.locator('button:has-text("אשר וצור")').click();
    await hr.waitForTimeout(1500);
    // the counter page appears (or the run is already done — both are legal)
    let tries = 0;
    while (tries++ < 20) {
      await hr.waitForTimeout(1000);
      const t = await hr.locator("body").innerText();
      if (t.includes("הייבוא הושלם")) break;
      await hr.reload();
    }
    const report = (await hr.locator("body").innerText()).replace(/\s+/g, " ");
    check("the run finished with a report", report.includes("הייבוא הושלם"));
    check("ONE person was created — the raced row was downgraded, not duplicated",
      report.includes("נוצרו 1"), report.slice(report.indexOf("נוצרו"), report.indexOf("נוצרו") + 30));
    check("the downgrade is reported by name", report.includes("אורי") && report.includes("נוצר בינתיים"),
      report.slice(report.indexOf("הייבוא הושלם"), report.indexOf("הייבוא הושלם") + 400));

    const dana = await prisma.person.findFirst({ where: { fullName: `דנה ${TAG}` }, include: { fieldValues: true } });
    check("דנה exists with her identity value", !!dana &&
      dana!.fieldValues.some((v) => normalizeIdentity(v.value) === "700000002"));
    check("into the right team", dana?.teamId === team.id);
    const oris = await prisma.person.count({ where: { firstName: "אורי", fullName: { contains: TAG } } });
    check("exactly one אורי in the registry — no duplicate", oris === 1, `${oris}`);
    const rons = await prisma.person.count({ where: { firstName: "רון", fullName: { contains: TAG } } });
    check("the error row was never created", rons === 0);
  } finally {
    await browser.close();
    await cleanup();
    check("no fixtures left behind", (await prisma.user.count({ where: { email: { endsWith: MAIL } } })) === 0);
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
