/**
 * Verification for recurring-event-score — the interview-style optional rating
 * on recurring-event fills, opt-in per event at authoring time.
 *
 * Needs the dev server on :4321 (the fills go through the real page).
 *
 *   npx tsx scripts/verify-recurring-score.ts
 */
import { chromium, type Browser, type Page } from "playwright";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

const BASE = process.env.BASE_URL ?? "http://localhost:4321";
const TAG = "rsverify";
const PASSWORD = "recurring-score-1";

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

async function signIn(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="identifier"]', `${TAG}-adm`);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click("form button");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
  return page;
}

async function main() {
  await cleanup();
  const center = await prisma.orgNode.create({ data: { name: `${TAG} מרכז`, kind: "CENTER" } });
  const domain = await prisma.orgNode.create({ data: { name: `${TAG} תחום`, kind: "DOMAIN", parentId: center.id } });
  const section = await prisma.orgNode.create({ data: { name: `${TAG} מדור`, kind: "SECTION", parentId: domain.id } });
  const team = await prisma.orgNode.create({ data: { name: `${TAG} צוות`, kind: "TEAM", parentId: section.id } });
  await prisma.user.create({
    data: { name: `${TAG} אדמין`, email: `${TAG}@verify.invalid`, username: `${TAG}-adm`, passwordHash: hashPassword(PASSWORD), role: "ADMIN" },
  });
  const placement = new Date();
  placement.setUTCMonth(placement.getUTCMonth() - 13);
  const person = await prisma.person.create({
    data: { firstName: TAG, lastName: "נבדק", fullName: `${TAG} נבדק`,
      recruitmentDate: placement, placementDate: placement, teamId: team.id },
  });
  const tplShell = await prisma.careerPlan.create({ data: { name: `${TAG} מסלול`, isTemplate: true } });

  const browser = await chromium.launch();
  try {
    const page = await signIn(browser);

    console.log("=== authoring: the checkbox writes the flag through the real editor ===");
    await page.goto(`${BASE}/plans/${tplShell.id}`);
    const addForm = page.locator('form:has(button:has-text("הוסף מחזורי"))');
    await addForm.locator('input[name="label"]').fill(`${TAG} משוב מדורג`);
    await addForm.locator('input[name="withScore"]').check();
    await addForm.locator('button:has-text("הוסף מחזורי")').click();
    await page.waitForSelector(`text=${TAG} משוב מדורג`);
    await addForm.locator('input[name="label"]').fill(`${TAG} משוב רגיל`);
    await addForm.locator('button:has-text("הוסף מחזורי")').click();
    await page.waitForSelector(`text=${TAG} משוב רגיל`);
    const tplEvents = await prisma.recurringEvent.findMany({ where: { plan: { id: tplShell.id } }, orderBy: { label: "asc" } });
    const rated = tplEvents.find((e) => e.label.includes("מדורג"))!;
    const plain = tplEvents.find((e) => e.label.includes("רגיל"))!;
    check("the rated event carries withScore", rated?.withScore === true);
    check("the plain event does not", plain?.withScore === false);
    check("the summary line names the option",
      await page.locator('li:has-text("משוב מדורג")').first().innerText().then((t) => t.includes("מילוי עם דירוג")));

    console.log("\n=== assignment: the copy inherits the flag ===");
    await page.goto(`${BASE}/people/${person.id}?assign=${tplShell.id}`);
    await page.waitForSelector('input[name="require"]');
    // require everything so past occurrences show as fillable slots
    const boxes = page.locator('input[name="require"]');
    for (let i = 0; i < (await boxes.count()); i++) if (!(await boxes.nth(i).isChecked())) await boxes.nth(i).check();
    await page.click('button:has-text("אשר שיוך")');
    await page.waitForURL((u) => u.searchParams.has("edit"), { timeout: 20000 });
    const copyEvents = await prisma.recurringEvent.findMany({
      where: { plan: { isTemplate: false, name: { startsWith: TAG } } }, orderBy: { label: "asc" },
    });
    check("the copy's rated event kept withScore", copyEvents.find((e) => e.label.includes("מדורג"))?.withScore === true);
    check("the copy's plain event kept false", copyEvents.find((e) => e.label.includes("רגיל"))?.withScore === false);

    console.log("\n=== filling: the select exists only where asked, the score lands ===");
    await page.goto(`${BASE}/people/${person.id}?edit=1`);
    const ratedRow = page.locator(`li:has-text("${TAG} משוב מדורג")`).first();
    const plainRow = page.locator(`li:has-text("${TAG} משוב רגיל")`).first();
    check("the rated slot offers the rating select", (await ratedRow.locator('select[name="score"]').count()) === 1);
    check("the plain slot does not", (await plainRow.locator('select[name="score"]').count()) === 0);

    await ratedRow.locator('textarea[name="content"]').fill("שיחה טובה");
    await ratedRow.locator('select[name="score"]').selectOption("4");
    await ratedRow.locator('button:has-text("מלא מופע")').click();
    await page.waitForFunction(
      (label) => !!document.querySelector(`li`) && Array.from(document.querySelectorAll("li")).some((li) => li.textContent?.includes(label) && li.textContent?.includes("✅")),
      `${TAG} משוב מדורג`, { timeout: 20000 },
    );
    const copyRated = copyEvents.find((e) => e.label.includes("מדורג"))!;
    let entry = await prisma.evalEntry.findFirst({ where: { personId: person.id, recurringEventId: copyRated.id } });
    check("the entry stored score 4", entry?.score === 4, String(entry?.score));
    check("the card shows the scale label pill", (await page.locator(`li:has-text("${TAG} משוב מדורג")`).first().innerText()).match(/4 ·/) !== null);

    // the plain event refuses nothing but stores nothing, even if a score is smuggled in
    await plainRow.locator('textarea[name="content"]').fill("בלי דירוג");
    await plainRow.locator('button:has-text("מלא מופע")').click();
    await page.waitForTimeout(2500);
    const copyPlain = copyEvents.find((e) => e.label.includes("רגיל"))!;
    entry = await prisma.evalEntry.findFirst({ where: { personId: person.id, recurringEventId: copyPlain.id } });
    check("the plain event's entry carries no score", entry != null && entry.score === null);
  } finally {
    await browser.close();
    await cleanup();
    const residue = (await prisma.careerPlan.count({ where: { name: { startsWith: TAG } } })) +
      (await prisma.person.count({ where: { fullName: { startsWith: TAG } } }));
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
