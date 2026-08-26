/**
 * Verification for long-list-containment — measured the way the problem was
 * found: in a real browser, against a registry large enough to break it.
 *
 * Before this change, 1000 people made the people page 1.7MB of HTML, 67,699
 * DOM nodes and 68 screens tall, with no scroll container anywhere. The checks
 * below are the shape of that measurement, turned into a guard.
 *
 * Needs the dev server on :4321.
 *
 *   npx tsx scripts/verify-list-containment.ts
 */
import { chromium, type Page } from "playwright";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";

const BASE = process.env.BASE_URL ?? "http://localhost:4321";
const TAG = "lcverify";
const PLANT = 600;
const VIEWPORT = { width: 1400, height: 900 };

let failures = 0;
let checks = 0;
function check(label: string, ok: boolean, detail = "") {
  checks++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function cleanup() {
  await prisma.person.deleteMany({ where: { fullName: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { username: { startsWith: TAG } } });
}

/** The page's own height, in screenfuls — the number that was 68. */
const screens = (p: Page) =>
  p.evaluate((h) => document.body.scrollHeight / h, VIEWPORT.height);

/** Does any element actually scroll its own overflow? */
const hasInnerScroller = (p: Page) =>
  p.evaluate(() =>
    Array.from(document.querySelectorAll("*")).some((el) => {
      const s = getComputedStyle(el);
      return (s.overflowY === "auto" || s.overflowY === "scroll") && el.scrollHeight > el.clientHeight + 40;
    }),
  );

async function main() {
  await cleanup();
  const before = await prisma.person.count();
  const team = await prisma.orgNode.findFirstOrThrow({ where: { kind: "TEAM" }, select: { id: true } });
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" }, select: { id: true } });

  const rows = Array.from({ length: PLANT }, (_, i) => ({
    firstName: TAG,
    lastName: `נבדק${String(i).padStart(3, "0")}`,
    fullName: `${TAG} נבדק${String(i).padStart(3, "0")}`,
    recruitmentDate: new Date("2021-01-01"),
    placementDate: new Date("2021-01-01"),
    teamId: team.id,
  }));
  for (let i = 0; i < rows.length; i += 200) await prisma.person.createMany({ data: rows.slice(i, i + 200) });

  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: VIEWPORT });
    await ctx.addCookies([{ name: SESSION_COOKIE, value: createSessionToken(admin.id), domain: "localhost", path: "/" }]);
    const page = await ctx.newPage();

    console.log(`=== the people page holds ${before + PLANT} people without stretching ===`);
    await page.goto(`${BASE}/people`, { waitUntil: "networkidle" });
    const tall = await screens(page);
    check("the page is a handful of screens, not dozens", tall < 4, `${tall.toFixed(1)} screens`);
    check("the rows scroll inside their own area", await hasInnerScroller(page));

    const rendered = () => page.locator("tbody tr").count();
    check("only the first page of rows is rendered", (await rendered()) === 100, `${await rendered()} rows`);
    const nodes = await page.evaluate(() => document.querySelectorAll("*").length);
    check("the DOM stays modest", nodes < 15000, `${nodes} nodes`);

    console.log("\n=== the header stays put while the body scrolls ===");
    const headerBefore = await page.locator("thead").boundingBox();
    await page.evaluate(() => {
      const sc = Array.from(document.querySelectorAll("*")).find(
        (el) => getComputedStyle(el).overflowY === "auto" && el.scrollHeight > el.clientHeight + 40,
      ) as HTMLElement | undefined;
      sc?.scrollTo(0, 800);
    });
    await page.waitForTimeout(300);
    const headerAfter = await page.locator("thead").boundingBox();
    check("the column headers are still on screen after scrolling",
      !!headerAfter && headerAfter.y >= 0 && Math.abs((headerAfter.y ?? 0) - (headerBefore?.y ?? 0)) < 8,
      `y ${headerBefore?.y?.toFixed(0)} → ${headerAfter?.y?.toFixed(0)}`);
    check("the filter row scrolled with it", (await page.locator('input[placeholder="סנן שם…"]').boundingBox())!.y > 0);

    console.log("\n=== «הצג עוד» reveals exactly one more page ===");
    const more = page.locator('button:has-text("הצג עוד")');
    check("the control is offered while rows remain", (await more.count()) === 1);
    check("it states how many of how many are shown",
      /מוצגים\s*100\s*מתוך/.test((await page.locator("text=מוצגים").last().innerText()).replace(/\s+/g, " ")));
    await more.click();
    await page.waitForTimeout(400);
    check("one press adds a page", (await rendered()) === 200, `${await rendered()} rows`);

    console.log("\n=== the ceiling never hides a match — the trap in this change ===");
    // this person sorts near the END of the registry, far past the ceiling
    const hidden = `נבדק${String(PLANT - 1).padStart(3, "0")}`;
    await page.fill('input[placeholder="סנן שם…"]', hidden);
    await page.waitForTimeout(500);
    check("a person past the ceiling is still found by the filter",
      (await page.locator(`tbody tr:has-text("${hidden}")`).count()) === 1,
      `${await rendered()} rows shown`);
    check("...and the filter reset the ceiling rather than inheriting it",
      (await rendered()) <= 100 && (await more.count()) === 0);
    await page.fill('input[placeholder="סנן שם…"]', "");
    await page.waitForTimeout(400);
    check("clearing the filter returns to the first page", (await rendered()) === 100, `${await rendered()} rows`);

    console.log("\n=== the dashboard and the other lists ===");
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const dash = await screens(page);
    check("the dashboard is no longer dozens of screens", dash < 8, `${dash.toFixed(1)} screens`);
    check("a large team's people scroll within the tree", await hasInnerScroller(page));

    await page.goto(`${BASE}/system/activity`, { waitUntil: "networkidle" });
    check("the activity log is contained too", (await screens(page)) < 4, `${(await screens(page)).toFixed(1)} screens`);
    check("...with its header sticky", (await page.locator("thead").boundingBox())!.y >= 0);
  } finally {
    await browser.close();
    await cleanup();
    const after = await prisma.person.count();
    check("the registry is back to its prior size", after === before, `${before} → ${after}`);
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
