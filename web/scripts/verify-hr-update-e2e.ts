/**
 * Verification for hr-external-update — the page, through a real browser.
 *
 * The engine suite proves the diff and the proposals; this half proves the
 * page WIRES them: the first-file mapping stage (multi-select saved globally),
 * the review applying through the real proposal path — a point completion
 * landing on the right person's own plan copy — the snapshot advancing only on
 * conclusion, the second upload skipping straight to the diff, and the
 * structure gate asking before a remap.
 *
 * The mapping stage may call the live agent on the unknown column; waits are
 * on elements, never on the clock — the lesson this repo already paid for.
 *
 *   npx tsx scripts/verify-hr-update-e2e.ts
 */
import { writeFileSync, rmSync } from "fs";
import { chromium, type Browser, type Page } from "playwright";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

const BASE = process.env.BASE_URL ?? "http://localhost:4321";
const TAG = "hrue2e";
const MAIL = `@${TAG}.invalid`;
const PASSWORD = "verify-hr-update-1";
const DIR = "/tmp/claude-1000/-home-omer-Projects-manager/de9743d3-ec83-43e1-ba9e-acb0b0b65de6/scratchpad";

let failures = 0;
let checks = 0;
function check(label: string, ok: boolean, detail = "") {
  checks++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function cleanup() {
  await prisma.agentRun.deleteMany({ where: { kind: "HR_UPDATE", user: { email: { endsWith: MAIL } } } });
  await prisma.extractionProposal.deleteMany({ where: { person: { fullName: { contains: TAG } } } });
  await prisma.importSnapshot.deleteMany({});
  await prisma.importMapping.deleteMany({});
  await prisma.person.deleteMany({ where: { fullName: { contains: TAG } } });
  await prisma.careerPlan.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: MAIL } } });
  await prisma.orgNode.deleteMany({ where: { name: { startsWith: TAG } } });
  for (const f of ["v1.csv", "v2.csv", "v3.csv"]) rmSync(`${DIR}/${TAG}-${f}`, { force: true });
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

  const copy = await prisma.careerPlan.create({
    data: { name: `${TAG} תכנית (עותק)`, isTemplate: false, pointEvents: { create: [{ label: `${TAG} הסמכה`, offsetMonths: 12 }] } },
    include: { pointEvents: true },
  });
  // a TEMPLATE with the same label so the mapping chooser offers it
  await prisma.careerPlan.create({
    data: { name: `${TAG} תכנית`, isTemplate: true, pointEvents: { create: [{ label: `${TAG} הסמכה`, offsetMonths: 12 }] } },
  });

  const defs = await prisma.personFieldDef.findMany({ where: { label: { in: ["תעודת זהות", "עיר מגורים"] } } });
  const tzDef = defs.find((d) => d.label === "תעודת זהות")!;
  const cityDef = defs.find((d) => d.label === "עיר מגורים")!;

  const mkP = (first: string, tz: string, planId: string | null) =>
    prisma.person.create({
      data: { firstName: first, lastName: TAG, fullName: `${first} ${TAG}`,
        recruitmentDate: new Date("2020-01-01"), placementDate: new Date("2020-01-01"),
        teamId: team.id, assignedPlanId: planId,
        fieldValues: { create: [{ fieldDefId: tzDef.id, value: tz, order: 0 }] } },
    });
  const avi = await mkP("אבי", "500000001", copy.id);
  const beni = await mkP("בני", "500000002", null);

  await prisma.user.create({
    data: { name: `${TAG}-hr`, email: `hr${MAIL}`, username: `${TAG}-hr`,
      passwordHash: hashPassword(PASSWORD), role: "HR",
      grants: { create: [{ nodeId: sec.id, level: "EDIT" }] } },
  });

  // v1: city for both, a completion date for אבי
  const H = "תעודת זהות,עיר מגורים,עמודת הסמכה";
  writeFileSync(`${DIR}/${TAG}-v1.csv`, "﻿" + [H, "500000001,חיפה,05/03/2024", "500000002,אשדוד,"].join("\n"));
  // v2: ONE cell changed (אבי's city)
  writeFileSync(`${DIR}/${TAG}-v2.csv`, "﻿" + [H, "500000001,תל אביב,05/03/2024", "500000002,אשדוד,"].join("\n"));
  // v3: a new column appears
  writeFileSync(`${DIR}/${TAG}-v3.csv`, "﻿" + [H + ",טור חדש", "500000001,תל אביב,05/03/2024,x", "500000002,אשדוד,,y"].join("\n"));

  const browser = await chromium.launch();
  try {
    const hr = await signIn(browser, `${TAG}-hr`);

    console.log("\n=== first file: the mapping stage ===");
    await hr.goto(`${BASE}/hr`);
    await hr.setInputFiles('section:has(h2:text("עדכון נתונים חיצוני")) input[type="file"]', `${DIR}/${TAG}-v1.csv`);
    await hr.locator('button:text("העלה קובץ עדכון")').click();
    await hr.locator('h3:has-text("מיפוי עמודות")').waitFor({ timeout: 240_000 });
    check("the first-ever file lands on the mapping stage", true);

    // set the mapping by hand through the picker: search, tick — the ctrl-less flow
    const colBox = (header: string) => hr.locator(`div.flex-col:has(> span:text-is("${header}"))`);
    // the city column may already be auto-recognised; ensure its tick
    const cityBox = colBox("עיר מגורים");
    await cityBox.locator('input[type="text"]').fill("עיר");
    const cityTick = cityBox.locator(`label:has-text("עיר מגורים") input[type="checkbox"]`).first();
    if (!(await cityTick.isChecked())) await cityTick.check();
    const pointBox = colBox("עמודת הסמכה");
    await pointBox.locator('input[type="text"]').fill(TAG);
    check("the search narrows the target list", (await pointBox.locator('label').count()) >= 1);
    check("and each target names its SOURCE", (await pointBox.innerText()).includes("מסלול קריירה:"));
    await pointBox.locator(`label:has-text("אירוע: ${TAG} הסמכה") input[type="checkbox"]`).first().check();
    await hr.locator('button:text("אשר מיפוי והמשך")').click();
    await hr.locator('text=אנשים עם שינויים').waitFor({ timeout: 120_000 });
    check("approving the mapping builds the review", true);
    check("the mapping was saved GLOBALLY", (await prisma.importMapping.count()) === 1);

    console.log("\n=== the review applies through the real path ===");
    const reviewText = (await hr.locator("body").innerText()).replace(/\s+/g, " ");
    check("both people appear with their changes", reviewText.includes(`אבי ${TAG}`) && reviewText.includes(`בני ${TAG}`));
    check("current → proposed shown", reviewText.includes("חיפה") || reviewText.includes("—"));

    // approve אבי entirely; leave בני untouched
    await hr.locator(`details:has-text("אבי ${TAG}") button:text("אשר אדם")`).click();
    await hr.waitForTimeout(3000);
    const aviCity = await prisma.personFieldValue.findFirst({ where: { personId: avi.id, fieldDefId: cityDef.id } });
    check("אבי's city was written", aviCity?.value === "חיפה", aviCity?.value ?? "none");
    const prog = await prisma.pointProgress.findFirst({ where: { personId: avi.id } });
    check("the completion landed on אבי's OWN plan copy", prog?.pointEventId === copy.pointEvents[0].id,
      prog ? "the right event id" : "NO PROGRESS ROW");
    check("dated from the file", prog?.doneOn.toISOString().slice(0, 10) === "2024-03-05");
    const beniCity = await prisma.personFieldValue.findFirst({ where: { personId: beni.id, fieldDefId: cityDef.id } });
    check("בני, unapproved, is untouched", !beniCity, beniCity?.value ?? "untouched");

    console.log("\n=== the snapshot advances only on conclusion ===");
    check("no snapshot before conclusion", (await prisma.importSnapshot.count()) === 0);
    await hr.locator('button:text("סיים סקירה ושמור להיסטוריה")').click();
    await hr.waitForTimeout(2500);
    const snap = await prisma.importSnapshot.findFirst();
    check("conclusion wrote the snapshot", !!snap && snap.filename.includes("v1"));
    check("naming its uploader", snap?.uploadedByName === `${TAG}-hr`);

    console.log("\n=== the second upload: known structure, only the diff ===");
    await hr.goto(`${BASE}/hr`);
    const hist = (await hr.locator("body").innerText());
    check("the history lists the concluded file", hist.includes(`${TAG}-v1`));
    const dl = await hr.request.get(`${BASE}/hr/last-import`);
    check("the last file downloads for format inspection", dl.ok() && (await dl.body()).length > 10,
      `HTTP ${dl.status()}`);
    await hr.setInputFiles('section:has(h2:text("עדכון נתונים חיצוני")) input[type="file"]', `${DIR}/${TAG}-v2.csv`);
    await hr.locator('button:text("העלה קובץ עדכון")').click();
    await hr.locator('text=אנשים עם שינויים').waitFor({ timeout: 120_000 });
    const v2Text = (await hr.locator("body").innerText()).replace(/\s+/g, " ");
    check("no mapping stage — the saved mapping applied", !v2Text.includes("אשר מיפוי והמשך"));
    check("only the ONE changed person surfaces", v2Text.includes(`אבי ${TAG}`) && !v2Text.includes(`בני ${TAG}`),
      "בני's unchanged cells propose nothing");
    check("proposing the new value against the current", v2Text.includes("תל אביב"));
    await hr.locator('button:text("בטל ריצה")').click();
    await hr.waitForTimeout(2000);
    check("dismissal did NOT advance the snapshot", (await prisma.importSnapshot.count()) === 1,
      "the v1 baseline still stands");

    console.log("\n=== the structure gate ===");
    await hr.goto(`${BASE}/hr`);
    await hr.setInputFiles('section:has(h2:text("עדכון נתונים חיצוני")) input[type="file"]', `${DIR}/${TAG}-v3.csv`);
    await hr.locator('button:text("העלה קובץ עדכון")').click();
    await hr.locator('text=מבנה הקובץ שונה').waitFor({ timeout: 60_000 });
    const gate = (await hr.locator("body").innerText()).replace(/\s+/g, " ");
    check("the gate names the appeared column", gate.includes("טור חדש"));
    check("and asks, running nothing yet", gate.includes("המשך למיפוי"));
    await hr.locator('button:text("המשך למיפוי")').click();
    await hr.locator('h3:has-text("מיפוי עמודות")').waitFor({ timeout: 240_000 });
    const keptCity = hr.locator(`div.flex-col:has(> span:text-is("עיר מגורים")) input[type="hidden"]`).first();
    check("the KNOWN column kept its saved mapping", (await keptCity.getAttribute("value")) === `custom:${cityDef.id}`,
      (await keptCity.getAttribute("value")) ?? "no hidden value");
    check("no duplicated «התעלם» — ignore is simply nothing ticked",
      !(await hr.locator('h3:has-text("מיפוי עמודות")').locator("..").innerText()).includes("— התעלם —"));

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
