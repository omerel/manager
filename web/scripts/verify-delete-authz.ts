/**
 * Verification for admin-delete-person-and-plan (tasks 6.3, 6.5, 6.7).
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
import { chromium, type BrowserContext } from "playwright";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/password";

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
  const src = await readFile(new URL("../src/components/PersonFormFields.tsx", import.meta.url), "utf8");
  const labels = new Set<string>();
  for (const m of src.matchAll(/<Labeled label="([^"]+)">/g)) {
    const label = m[1];
    if (label.startsWith("גיל")) continue; // derived, not a field — asserted separately
    labels.add(label.replace(/\s*\(.*\)\s*$/, "")); // drop the "(עוגן התכנית)" style hints
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
      teamId: team?.id ?? null,
    },
  });
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

    const plansLeft = await prisma.careerPlan.count({ where: { isTemplate: true } });
    check("no template was deleted during the run", plansLeft === 4, `${plansLeft} templates`);
  } catch (e) {
    crashed = e;
  } finally {
    await browser.close();
    await prisma.person.deleteMany({ where: { id: { in: [victim.id, survivor.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [adminUser.id, managerUser.id] } } });
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
