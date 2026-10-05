/**
 * Verification for confirm-every-action — a save that succeeds says so.
 *
 * The fault was not a missing feature. `withState` has returned `{ done }` on
 * every success since it was written and `ActionForm` already received it,
 * using it only to reset the form. Ninety-odd forms stayed silent because
 * showing it was something each one would have had to ask for.
 *
 * So the centre of this suite is the DEFAULT: that a form which says nothing
 * about confirmation confirms anyway. A check that only proved "the toast can
 * appear" would pass just as well under the arrangement that produced the
 * silence.
 *
 * Needs the dev server on :4321.
 *
 *   npx tsx scripts/verify-action-confirm.ts
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { withState } from "@/lib/action-state";
import { DEFAULT_CONFIRM, CONFIRM_MS, ERROR_MS } from "@/components/OutcomeToast";

const BASE = process.env.BASE_URL ?? "http://localhost:4321";
const TAG = "cfmverify";
const PASSWORD = "confirm-verify-1234";

let failures = 0;
let checks = 0;
function check(label: string, ok: boolean, detail = "") {
  checks++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function cleanup() {
  await prisma.personFieldDef.deleteMany({ where: { label: { startsWith: TAG } } });
  await prisma.orgNode.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { username: { startsWith: TAG } } });
}

async function main() {
  await cleanup();
  const admin = await prisma.user.create({
    data: { name: `${TAG} אדמין`, email: `${TAG}@v.invalid`, username: `${TAG}-adm`, passwordHash: hashPassword(PASSWORD), role: "ADMIN" },
  });

  try {
    console.log("=== the signal the component had all along ===");
    const ok = await withState(async () => {})(null, new FormData());
    check("a successful action returns { done }", !!ok && "done" in ok, JSON.stringify(ok));
    const bad = await withState(async () => { throw new Error("סירוב"); })(null, new FormData());
    check("a refused action still returns { error }", !!bad && "error" in bad, JSON.stringify(bad));

    console.log("\n=== confirming is the DEFAULT, not an option ===");
    const src = readFileSync("src/components/ActionForm.tsx", "utf8");
    check("the confirmation is suppressed only by an explicit false",
      src.includes("confirmText === false"), "not by requiring opt-in");
    check("a form that says nothing gets the neutral default",
      src.includes("confirmText || DEFAULT_CONFIRM"));
    check("the default wording is neutral, not «נשמר»",
      DEFAULT_CONFIRM === "הפעולה בוצעה" && !DEFAULT_CONFIRM.includes("נשמר"), DEFAULT_CONFIRM);
    check("a confirmation clears sooner than a refusal",
      CONFIRM_MS < ERROR_MS, `${CONFIRM_MS}ms vs ${ERROR_MS}ms`);

    console.log("\n=== one definition for both outcomes ===");
    const toast = readFileSync("src/components/OutcomeToast.tsx", "utf8");
    check("a refusal interrupts (role=alert)", toast.includes('role={error ? "alert"'));
    check("a confirmation is announced without interrupting (role=status)", toast.includes('"status"'));
    check("both kinds come from the same component — no second toast to drift",
      toast.includes("data-action-toast") && toast.includes("data-action-confirm"));
    const inline = execSync(
      `grep -rln 'data-action-confirm' src/components src/app --include='*.tsx' || true`, { encoding: "utf8" },
    ).trim().split("\n").filter(Boolean);
    check("exactly one component renders the confirmation markup",
      inline.length === 1 && inline[0] === "src/components/OutcomeToast.tsx", inline.join(", "));

    console.log("\n=== exemptions are decisions, and they are visible ===");
    const exempt = execSync(
      `grep -rn 'confirmText={false}' src/app src/components --include='*.tsx' || true`, { encoding: "utf8" },
    ).trim().split("\n").filter(Boolean);
    check("the forms whose result is self-evident opt out in their own source",
      exempt.length > 0, `${exempt.length} forms`);
    check("...and every one of them is a removal the user watches happen",
      exempt.every((l) => /remove|delete|unassign/i.test(l)),
      exempt.find((l) => !/remove|delete|unassign/i.test(l)) ?? "all removals");

    console.log("\n=== the browser: a save that changes nothing visible ===");
    const cookie = `${SESSION_COOKIE}=${createSessionToken(admin.id)}`;
    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: SESSION_COOKIE, value: createSessionToken(admin.id), domain: "localhost", path: "/" }]);
    const page = await ctx.newPage();

    // adding a framework: the tree below re-renders, but the form itself gives
    // no sign — the case this change exists for
    await page.goto(`${BASE}/hierarchy`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('input[name="name"]');
    await page.fill('input[name="name"]', `${TAG} מרכז`);
    await page.selectOption('select[name="kind"]', "CENTER");
    await page.selectOption('select[name="parentId"]', "");
    await page.click('button:has-text("הוסף מסגרת")');
    await page.waitForSelector("[data-action-confirm]", { timeout: 8000 }).catch(() => {});
    const confirmEl = page.locator("[data-action-confirm]");
    check("a successful save shows a confirmation", (await confirmEl.count()) > 0,
      (await confirmEl.count()) ? (await confirmEl.innerText()).replace(/\s+/g, " ").trim() : "NONE");
    check("...worded as the neutral default", ((await confirmEl.count()) > 0) && (await confirmEl.innerText()).includes(DEFAULT_CONFIRM));
    check("...and announced as a status, not an alert",
      (await confirmEl.getAttribute("role")) === "status", String(await confirmEl.getAttribute("role")));
    check("no refusal toast appears beside it", (await page.locator("[data-action-toast]").count()) === 0);

    // it leaves on its own
    await page.waitForTimeout(CONFIRM_MS + 900);
    check("the confirmation clears itself", (await page.locator("[data-action-confirm]").count()) === 0);

    // a refusal: the same name again, which the uniqueness rule refuses…
    // (a CENTER may repeat, so use the kind rule instead — commanders under a team)
    await page.goto(`${BASE}/hierarchy`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('input[name="name"]');
    await page.fill('input[name="name"]', `${TAG} מפקדים`);
    await page.selectOption('select[name="kind"]', "COMMANDERS");
    const centerRow = await prisma.orgNode.findFirstOrThrow({ where: { name: `${TAG} מרכז` } });
    await page.selectOption('select[name="parentId"]', centerRow.id);
    await page.click('button:has-text("הוסף מסגרת")');
    await page.waitForSelector("[data-action-confirm]", { timeout: 8000 }).catch(() => {});
    check("a commanders framework under a center is accepted, and confirmed",
      (await page.locator("[data-action-confirm]").count()) > 0);
    await page.waitForTimeout(CONFIRM_MS + 900);

    // now a real refusal — the same commanders name twice
    await page.goto(`${BASE}/hierarchy`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('input[name="name"]');
    await page.fill('input[name="name"]', `${TAG} מפקדים`);
    await page.selectOption('select[name="kind"]', "COMMANDERS");
    await page.selectOption('select[name="parentId"]', centerRow.id);
    await page.click('button:has-text("הוסף מסגרת")');
    await page.waitForSelector("[data-action-toast]", { timeout: 8000 }).catch(() => {});
    const errEl = page.locator("[data-action-toast]");
    check("a refusal still shows the red toast", (await errEl.count()) > 0,
      (await errEl.count()) ? (await errEl.innerText()).replace(/\s+/g, " ").slice(0, 70) : "NONE");
    check("...still as an alert", (await errEl.getAttribute("role")) === "alert");
    check("a refused save shows NO confirmation", (await page.locator("[data-action-confirm]").count()) === 0,
      "the two must never appear together");

    console.log("\n=== an exempted form stays quiet ===");
    // removing an enum option — the chip leaves the list, which says it happened
    const field = await prisma.personFieldDef.create({
      data: { key: `${TAG}_enum`, label: `${TAG} רשימה`, type: "ENUM", order: 997, options: [`${TAG}-אלף`, `${TAG}-בית`] },
    });
    await page.goto(`${BASE}/hierarchy`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(`text=${TAG} רשימה`);
    // SCOPED to this suite's own field. `.first()` took whichever remove button
    // the page happened to render first — another field's — and really removed
    // another field's value. A fixture that reaches outside itself is not a
    // fixture; it is damage that happens to be green.
    // targeted at THIS suite's own chip, by a value only it could have written
    const ownChip = page.locator("li").filter({ hasText: `${TAG}-אלף` });
    await ownChip.locator('button:has-text("הסר")').click();
    await page.waitForTimeout(1800);
    check("removing a list value shows no confirmation — the chip leaving is the answer",
      (await page.locator("[data-action-confirm]").count()) === 0);
    const after = await prisma.personFieldDef.findUniqueOrThrow({ where: { id: field.id } });
    check("...and it really was removed", after.options.length === 1, after.options.join(", "));

    console.log("\n=== the framework editor, which used to close in silence ===");
    await page.goto(`${BASE}/hierarchy`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(`text=${TAG} מרכז`);
    await page.locator('button[title="ערוך מסגרת"]').last().click();
    await page.waitForSelector('input[aria-label="שם המסגרת"]');
    await page.fill('input[aria-label="שם המסגרת"]', `${TAG} מרכז ב`);
    await page.click('button:has-text("שמור")');
    await page.waitForSelector("[data-action-confirm]", { timeout: 8000 }).catch(() => {});
    check("editing a framework confirms", (await page.locator("[data-action-confirm]").count()) > 0,
      (await page.locator("[data-action-confirm]").count()) ? (await page.locator("[data-action-confirm]").innerText()).replace(/\s+/g, " ").trim() : "NONE");

    // cancelling is not succeeding
    await page.waitForTimeout(CONFIRM_MS + 900);
    await page.goto(`${BASE}/hierarchy`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(`text=${TAG} מרכז ב`);
    await page.locator('button[title="ערוך מסגרת"]').last().click();
    await page.waitForSelector('button:has-text("ביטול")');
    await page.locator('button:has-text("ביטול")').click();
    await page.waitForTimeout(1200);
    check("backing out of an edit confirms NOTHING",
      (await page.locator("[data-action-confirm]").count()) === 0, "cancel is not a save");

    console.log("\n=== the components that speak for themselves keep their words ===");
    const orgImport = readFileSync("src/components/OrgImport.tsx", "utf8");
    check("OrgImport still names what it imported", orgImport.includes("העץ יובא בהצלחה"));
    const devWipe = readFileSync("src/components/DevWipe.tsx", "utf8");
    check("DevWipe still counts what it removed", devWipe.includes("המחיקה בוצעה בהצלחה"));
    check("neither was given a generic confirmation beside its own",
      !orgImport.includes("data-action-confirm") && !devWipe.includes("data-action-confirm"));

    await browser.close();
  } finally {
    await cleanup();
    const residue =
      (await prisma.orgNode.count({ where: { name: { startsWith: TAG } } })) +
      (await prisma.user.count({ where: { username: { startsWith: TAG } } })) +
      (await prisma.personFieldDef.count({ where: { label: { startsWith: TAG } } }));
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
