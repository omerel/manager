/**
 * Verification for israeli-date-format (tasks 6.3, 6.4, 6.5), against the dev
 * server. Types Israeli dates into every date field and asserts what was
 * STORED — the whole failure mode is a value that looks right on screen and is
 * five months off in the database.
 *
 *   npx tsx --env-file=.env scripts/verify-dates-e2e.ts
 */
import { chromium, type Page } from "playwright";
import { prisma } from "../src/lib/prisma";
import { createSessionToken } from "../src/lib/auth";

const BASE = process.env.BASE_URL ?? "http://localhost:4321";

let failures = 0;
let checks = 0;
function check(label: string, ok: boolean, detail = "") {
  checks++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}
const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

async function main() {
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" }, select: { id: true } });
  const team = await prisma.orgNode.findFirst({ where: { kind: "TEAM" } });
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  await ctx.addCookies([{ name: "session", value: createSessionToken(admin.id), domain: "localhost", path: "/" }]);
  const page: Page = await ctx.newPage();
  let createdId: string | null = null;

  try {
    console.log("\n=== 6.3 dates typed as dd/mm/yyyy are stored as written ===");
    await page.goto(`${BASE}/people/new`);
    await page.waitForTimeout(1500);

    check("date fields are text, not native pickers",
      (await page.locator('input[name="recruitmentDate"]').getAttribute("type")) === "text");
    check("the format is stated in the field",
      (await page.locator('input[name="recruitmentDate"]').getAttribute("placeholder")) === "dd/mm/yyyy");

    await page.fill('input[name="firstName"]', "בדיקת");
    await page.fill('input[name="lastName"]', "תאריכים");
    await page.fill('input[name="birthDate"]', "05/11/1994");
    await page.fill('input[name="recruitmentDate"]', "03/08/2020");
    await page.fill('input[name="placementDate"]', "09/12/2021");
    await page.fill('input[name="endOfServiceDate"]', "01/02/2030");
    if (team) await page.selectOption('select[name="teamId"]', team.id).catch(() => {});
    await page.getByRole("button", { name: /צור עובד/ }).click();
    await page.waitForTimeout(3000);

    const p = await prisma.person.findFirst({
      where: { fullName: "בדיקת תאריכים" },
      select: { id: true, birthDate: true, recruitmentDate: true, placementDate: true, endOfServiceDate: true },
    });
    check("the person was created", p !== null);
    if (p) {
      createdId = p.id;
      check("birth 05/11/1994 → 1994-11-05 (not 1994-05-11)", iso(p.birthDate) === "1994-11-05", iso(p.birthDate) ?? "");
      check("recruitment 03/08/2020 → 2020-08-03 (not 2020-03-08)", iso(p.recruitmentDate) === "2020-08-03", iso(p.recruitmentDate) ?? "");
      check("placement 09/12/2021 → 2021-12-09 (not 2021-09-12)", iso(p.placementDate) === "2021-12-09", iso(p.placementDate) ?? "");
      check("end of service 01/02/2030 → 2030-02-01", iso(p.endOfServiceDate) === "2030-02-01", iso(p.endOfServiceDate) ?? "");

      await page.goto(`${BASE}/people/${p.id}?edit=1`);
      await page.waitForTimeout(1500);
      const shown = await page.locator('input[name="recruitmentDate"]').inputValue();
      check("the edit form renders it back as 03/08/2020", shown === "03/08/2020", shown);
    }

    console.log("\n=== 6.4 an impossible date is refused ===");
    await page.goto(`${BASE}/people/new`);
    await page.waitForTimeout(1200);
    await page.fill('input[name="firstName"]', "לא");
    await page.fill('input[name="lastName"]', "יישמר");
    await page.fill('input[name="birthDate"]', "31/02/2026");
    await page.fill('input[name="recruitmentDate"]', "01/01/2020");
    await page.fill('input[name="placementDate"]', "01/01/2020");
    await page.getByRole("button", { name: /צור עובד/ }).click();
    await page.waitForTimeout(2000);
    const leaked = await prisma.person.count({ where: { fullName: "לא יישמר" } });
    check("nothing was stored for an impossible date", leaked === 0, `${leaked} rows`);

    console.log("\n=== 6.5 an extracted Israeli date is read day-first ===");
    const { proposeFieldUpdates } = await import("../src/lib/proposals");
    const { extractionFields } = await import("../src/lib/doc-extract");
    const fields = await extractionFields();
    if (createdId) {
      const items = await proposeFieldUpdates(
        admin.id,
        createdId,
        [
          { key: "recruitmentDate", proposed: "04/09/2020" }, // Israeli: 4 September
          { key: "birthDate", proposed: "March 5, 1994" }, // unreadable → must be dropped
        ],
        fields,
      );
      const rec = items.find((i) => i.key === "recruitmentDate");
      check("an Israeli date is proposed as 2020-09-04", rec?.proposed === "2020-09-04", rec?.proposed ?? "absent");
      check("an unreadable date is dropped, not guessed", !items.some((i) => i.key === "birthDate"),
        items.map((i) => i.key).join(","));
      await prisma.extractionProposal.deleteMany({ where: { personId: createdId } });
    }
  } finally {
    await browser.close();
    if (createdId) await prisma.person.deleteMany({ where: { id: createdId } });
    await prisma.person.deleteMany({ where: { fullName: "לא יישמר" } });
    console.log(failures === 0 ? `\nall ${checks} checks passed` : `\nFAILED — ${checks} ran, ${failures} failed`);
    await prisma.$disconnect();
    process.exit(failures ? 1 : 0);
  }
}

main();
