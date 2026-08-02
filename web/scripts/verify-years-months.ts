/**
 * E2E for plan-years-months-and-recurring-start (task 5.3), against the dev
 * server. Creates a throwaway plan and admin, deletes both at the end.
 */
import { chromium, type BrowserContext } from "playwright";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/password";

const BASE = process.env.BASE_URL ?? "http://localhost:4321";
const PASSWORD = "verify-ym-1234";

let failures = 0;
let checksRun = 0;
function check(label: string, ok: boolean, detail = "") {
  checksRun++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function login(ctx: BrowserContext) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="identifier"]', "verify.ym");
  await page.fill('input[name="password"]', PASSWORD);
  await page.click("form button");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });
  return page;
}

async function main() {
  const user = await prisma.user.create({
    data: { username: "verify.ym", email: "verify.ym@example.invalid", name: "בודק", role: "ADMIN", passwordHash: hashPassword(PASSWORD) },
  });
  const plan = await prisma.careerPlan.create({ data: { name: "תכנית בדיקת פורמט" } });

  const browser = await chromium.launch();
  let crashed: unknown = null;
  try {
    const ctx = await browser.newContext();
    const page = await login(ctx);
    await page.goto(`${BASE}/plans/${plan.id}`);

    // --- point event authored as 3.4 ---
    await page.fill("#label", "מעבר תפקיד");
    await page.fill("#offsetMonths", "3.4");
    check("a valid value shows no caption", (await page.locator("#offsetMonths ~ span").count()) === 0);
    await page.getByRole("button", { name: "הוסף נקודתי" }).click();
    await page.waitForTimeout(1500);
    const stored = await prisma.pointEvent.findFirst({ where: { planId: plan.id, label: "מעבר תפקיד" } });
    check("stored as 40 months", stored?.offsetMonths === 40, String(stored?.offsetMonths));
    await page.reload();
    const body = () => page.locator("body").textContent().then((t) => t ?? "");
    check("displayed as +3.4", (await body()).includes("3.4"));

    // --- the trap: 2.10 must be ten months, not one ---
    await page.fill("#label", "עשרה חודשים");
    await page.fill("#offsetMonths", "2.10");
    await page.getByRole("button", { name: "הוסף נקודתי" }).click();
    await page.waitForTimeout(1500);
    const ten = await prisma.pointEvent.findFirst({ where: { planId: plan.id, label: "עשרה חודשים" } });
    check("2.10 stored as 34 months (not 25)", ten?.offsetMonths === 34, String(ten?.offsetMonths));

    // --- recurring: start 2.0, every 12, stop 6.0 → occurrences 2.0..6.0 ---
    await page.fill('#label >> nth=-1', "").catch(() => {});
    const rform = page.locator("form", { has: page.getByRole("button", { name: "הוסף מחזורי" }) });
    await rform.locator("input#label, input[name='label']").fill("סקירה שנתית");
    await rform.locator("#intervalMonths").fill("12");
    await rform.locator("#startOffsetMonths").fill("2.0");
    await rform.locator("#stopOffsetMonths").fill("6.0");
    await rform.getByRole("button", { name: "הוסף מחזורי" }).click();
    await page.waitForTimeout(1500);
    const rec = await prisma.recurringEvent.findFirst({ where: { planId: plan.id, label: "סקירה שנתית" } });
    check("recurring stored start=24 stop=72", rec?.startOffsetMonths === 24 && rec?.stopOffsetMonths === 72,
      `start=${rec?.startOffsetMonths} stop=${rec?.stopOffsetMonths}`);
    await page.reload();
    const text = await body();
    check("occurrences shown 2.0…6.0", text.includes("+2.0") && text.includes("+6.0"));
    check("no occurrence before the start (no +1.0)", !text.includes("+1.0"));

    // --- 2.12 flagged inline before ever submitting ---
    await page.fill("#offsetMonths", "2.12");
    const badEcho = await page.locator("#offsetMonths ~ span").textContent();
    check('"2.12" is flagged invalid inline', badEcho?.includes("0–11") === true, badEcho ?? "");
  } catch (e) {
    crashed = e;
  } finally {
    await browser.close();
    await prisma.careerPlan.delete({ where: { id: plan.id } });
    await prisma.user.delete({ where: { id: user.id } });
    if (crashed) console.error("\nRUN CRASHED:", crashed instanceof Error ? crashed.stack : crashed);
    const clean = !crashed && failures === 0 && checksRun > 0;
    console.log(clean ? `\nall ${checksRun} checks passed` : `\nFAILED — ${checksRun} ran, ${failures} failed${crashed ? ", crashed" : ""}`);
    await prisma.$disconnect();
    process.exit(clean ? 0 : 1);
  }
}

main();
