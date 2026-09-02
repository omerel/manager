/**
 * Verification for usage-dashboard.
 *
 * The trap this change was built around: `logActivity` writes NOTHING without a
 * session, and during a sign-in there is none — so a naive implementation
 * records no logins and looks like it worked. The first section therefore signs
 * in through the real form and reads the database back.
 *
 * Needs the dev server on :4321.
 *
 *   npx tsx scripts/verify-usage-dashboard.ts
 */
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { availableWindows, usageStats } from "@/lib/usage-stats";

const BASE = process.env.BASE_URL ?? "http://localhost:4321";
const TAG = "udverify";
const PASSWORD = "usage-dash-1";

let failures = 0;
let checks = 0;
function check(label: string, ok: boolean, detail = "") {
  checks++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function cleanup() {
  const users = await prisma.user.findMany({ where: { username: { startsWith: TAG } }, select: { id: true } });
  await prisma.activityLog.deleteMany({ where: { actorId: { in: users.map((u) => u.id) } } });
  await prisma.user.deleteMany({ where: { username: { startsWith: TAG } } });
}

/** An Israeli-time day key, the same way the aggregation forms one. */
const dayKey = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

async function main() {
  await cleanup();
  const admin = await prisma.user.create({
    data: { name: `${TAG} אדמין`, email: `${TAG}a@v.invalid`, username: `${TAG}-adm`, passwordHash: hashPassword(PASSWORD), role: "ADMIN" },
  });
  const manager = await prisma.user.create({
    data: { name: `${TAG} מפקד`, email: `${TAG}m@v.invalid`, username: `${TAG}-mgr`, passwordHash: hashPassword(PASSWORD), role: "MANAGER" },
  });
  const quiet = await prisma.user.create({
    data: { name: `${TAG} שקט`, email: `${TAG}q@v.invalid`, username: `${TAG}-quiet`, passwordHash: hashPassword(PASSWORD), role: "HR" },
  });
  const cookie = `${SESSION_COOKIE}=${createSessionToken(admin.id)}`;

  try {
    console.log("=== a sign-in is recorded — the trap this change is about ===");
    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    const page = await (await browser.newContext()).newPage();

    // a REFUSED attempt first: it must leave nothing behind
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="identifier"]', `${TAG}-mgr`);
    await page.fill('input[name="password"]', "wrong-password");
    await page.click("form button");
    await page.waitForURL((u) => u.searchParams.has("error"), { timeout: 15000 });
    check("a refused sign-in writes no entry",
      (await prisma.activityLog.count({ where: { actorId: manager.id, action: "auth.login" } })) === 0);
    check("...and stamps no time",
      (await prisma.user.findUniqueOrThrow({ where: { id: manager.id } })).lastLoginAt === null);

    await page.fill('input[name="identifier"]', `${TAG}-mgr`);
    await page.fill('input[name="password"]', PASSWORD);
    await page.click("form button");
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });
    await page.waitForTimeout(600);
    const entry = await prisma.activityLog.findFirst({ where: { actorId: manager.id, action: "auth.login" } });
    check("a real sign-in writes an entry attributed to them", !!entry && entry.actorName.includes("מפקד"), String(entry?.actorName));
    check("...and stamps lastLoginAt",
      !!(await prisma.user.findUniqueOrThrow({ where: { id: manager.id } })).lastLoginAt);
    await browser.close();

    console.log("\n=== the aggregation counts what it is given ===");
    const now = new Date();
    // two actions and one extra login for the manager, on known days
    await prisma.activityLog.createMany({
      data: [
        { actorId: manager.id, actorName: manager.name, action: "person.create", description: "x", createdAt: now },
        { actorId: manager.id, actorName: manager.name, action: "person.delete", description: "x", createdAt: now },
        { actorId: admin.id, actorName: admin.name, action: "org.export", description: "x", createdAt: now },
      ],
    });
    let stats = await usageStats({ days: 7 });
    const mgrRow = stats.users.find((u) => u.userId === manager.id)!;
    check("the user's actions are counted", mgrRow.actions === 2, `${mgrRow.actions}`);
    check("their sign-in is counted separately, never as an action", mgrRow.logins === 1, `${mgrRow.logins}`);
    check("a user with nothing shows zeroes rather than vanishing",
      stats.users.find((u) => u.userId === quiet.id)?.actions === 0);
    check("active counts only those seen in the window",
      stats.users.filter((u) => u.logins + u.actions > 0).length >= 2);
    check("the families come from the action names themselves",
      stats.families.some((f) => f.family === "person") && stats.families.some((f) => f.family === "auth"),
      stats.families.map((f) => f.family).join(", "));
    check("someone who never signed in is dormant",
      stats.users.find((u) => u.userId === quiet.id)!.lastLoginAt === null && stats.dormant >= 1);

    console.log("\n=== a day is an ISRAELI day — the bug a UTC bucket would hide ===");
    // 21:30 UTC yesterday is 00:30 TODAY in Israel (UTC+3 in summer, +2 in winter)
    const lateNight = new Date();
    lateNight.setUTCDate(lateNight.getUTCDate() - 1);
    lateNight.setUTCHours(21, 30, 0, 0);
    const israeliDay = dayKey(lateNight);
    const utcDay = lateNight.toISOString().slice(0, 10);
    await prisma.activityLog.create({
      data: { actorId: quiet.id, actorName: quiet.name, action: "eval.fill", description: "אחרי חצות", createdAt: lateNight },
    });
    stats = await usageStats({ days: 7 });
    const bucket = stats.daily.find((d) => d.day === israeliDay);
    check("the entry lands on its Israeli day", (bucket?.actions ?? 0) >= 1, `${israeliDay}`);
    check("...which is NOT the UTC day — so the test can actually fail", israeliDay !== utcDay,
      `israeli ${israeliDay} vs utc ${utcDay}`);

    console.log("\n=== windows cannot outrun the retention ===");
    const before = process.env.ACTIVITY_LOG_DAYS;
    process.env.ACTIVITY_LOG_DAYS = "30";
    check("at 30 days retention, no 90-day window is offered", !availableWindows().includes(90),
      availableWindows().join(", "));
    process.env.ACTIVITY_LOG_DAYS = "0";
    check("kept forever, every window is offered", availableWindows().length === 3);
    process.env.ACTIVITY_LOG_DAYS = "7";
    check("at 7 days, only the 7-day window remains", availableWindows().join() === "7");
    if (before === undefined) delete process.env.ACTIVITY_LOG_DAYS;
    else process.env.ACTIVITY_LOG_DAYS = before;

    console.log("\n=== narrowing to one user ===");
    const one = await usageStats({ days: 7, userId: manager.id });
    check("every figure describes them alone",
      one.users.length === 1 && one.users[0].userId === manager.id && one.totalUsers === 1);
    check("their totals match the full view", one.actions === mgrRow.actions && one.logins === mgrRow.logins);
    check("the focus is named for the page to state", one.focus?.name === manager.name);

    console.log("\n=== the page and its exports are the Admin's alone ===");
    const asUser = (id: string, path: string) =>
      fetch(`${BASE}${path}`, { headers: { cookie: `${SESSION_COOKIE}=${createSessionToken(id)}` }, redirect: "manual" });
    check("the Admin gets the page", (await asUser(admin.id, "/system/usage")).status === 200);
    check("a Manager is redirected away", [302, 303, 307].includes((await asUser(manager.id, "/system/usage")).status),
      `HTTP ${(await asUser(manager.id, "/system/usage")).status}`);
    check("an HR user is too", [302, 303, 307].includes((await asUser(quiet.id, "/system/usage")).status));
    check("a Manager cannot take the export either",
      (await asUser(manager.id, "/system/usage/export?format=xlsx&days=7")).status === 404);

    console.log("\n=== the daily chart actually draws ===");
    // a percentage height against an auto-height parent computes to zero, and
    // the chart renders EMPTY while every number on the page stays right — so
    // the bars are measured in a browser, not merely asserted to exist
    const shot = await chromium.launch();
    const sctx = await shot.newContext({ viewport: { width: 1400, height: 1000 } });
    await sctx.addCookies([{ name: SESSION_COOKIE, value: createSessionToken(admin.id), domain: "localhost", path: "/" }]);
    const spage = await sctx.newPage();
    await spage.goto(`${BASE}/system/usage?days=7`, { waitUntil: "networkidle" });
    const tallest = await spage.evaluate(() => {
      const bars = Array.from(document.querySelectorAll("[title*='כניסות']"));
      let max = 0;
      for (const b of bars) for (const seg of Array.from(b.children)) max = Math.max(max, (seg as HTMLElement).clientHeight);
      return max;
    });
    check("a day with activity draws a bar with real height", tallest > 4, `${tallest}px`);
    await shot.close();

    console.log("\n=== the exports carry the same figures ===");
    const xls = await fetch(`${BASE}/system/usage/export?format=xlsx&days=7`, { headers: { cookie } });
    check("the workbook responds", xls.status === 200 && (xls.headers.get("content-type") ?? "").includes("spreadsheetml"));
    const wb = XLSX.read(Buffer.from(await xls.arrayBuffer()), { type: "buffer" });
    check("it has a sheet per view", wb.SheetNames.length === 3, wb.SheetNames.join(", "));
    const grid = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: false });
    const mgrLine = grid.find((r) => String(r[0]).includes("מפקד"));
    check("the per-user sheet agrees with the aggregation",
      mgrLine?.[2] === String(mgrRow.logins) && mgrLine?.[3] === String(mgrRow.actions),
      mgrLine?.slice(0, 4).join(" | "));

    const pdf = await fetch(`${BASE}/system/usage/export?format=pdf&days=7`, { headers: { cookie } });
    const buf = Buffer.from(await pdf.arrayBuffer());
    check("the report is a real PDF", buf.subarray(0, 4).toString() === "%PDF" && buf.length > 5000, `${buf.length} bytes`);
    const named = await fetch(`${BASE}/system/usage/export?format=pdf&days=7&user=${manager.id}`, { headers: { cookie } });
    check("a narrowed report names the person in its filename",
      decodeURIComponent(named.headers.get("content-disposition") ?? "").includes("מפקד"));
  } finally {
    await cleanup();
    const residue = await prisma.user.count({ where: { username: { startsWith: TAG } } });
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
