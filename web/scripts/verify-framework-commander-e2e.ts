/**
 * Verification for framework-commander — the actions, through the real forms.
 *
 * The rules layer is covered by verify-framework-commander.ts, which calls the
 * helpers directly. That suite cannot prove the one thing that matters most
 * here: that `createUser`, `updateUserProfile` and `removeGrant` actually CALL
 * those helpers. An action that forgot to would pass every check over there.
 *
 * So this half drives the browser as a real Admin: it fills the forms, submits
 * them, and reads the database afterwards. A guard that isn't wired shows up
 * immediately as a user who was created when they should not have been.
 *
 * Requires the dev server (BASE_URL, default http://localhost:4321).
 *
 *   npx tsx scripts/verify-framework-commander-e2e.ts
 */
import { chromium, type BrowserContext, type Page } from "playwright";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

const BASE = process.env.BASE_URL ?? "http://localhost:4321";
const TAG = "fce2e";
const MAIL = `@${TAG}.invalid`;
const PASSWORD = "verify-commander-1234";

let failures = 0;
let checks = 0;
function check(label: string, ok: boolean, detail = "") {
  checks++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: { endsWith: MAIL } } });
  await prisma.orgNode.deleteMany({ where: { name: { startsWith: TAG } } });
}

async function login(ctx: BrowserContext, username: string): Promise<Page> {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="identifier"]', username);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"], form button');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
  return page;
}

/**
 * All text on the page, INCLUDING the dev error overlay.
 *
 * A server action that throws renders its message into <nextjs-portal>, whose
 * content sits behind a shadow root — `page.content()` cannot see it, so a
 * check that looked there would report "no error shown" for every refusal the
 * user can plainly read on screen.
 */
async function fullText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const out: string[] = [document.body?.innerText ?? ""];
    for (const el of Array.from(document.querySelectorAll("*"))) {
      const root = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
      if (root) out.push(root.textContent ?? "");
    }
    return out.join(" ").replace(/\s+/g, " ");
  });
}

/** Submit the create-user form. Returns all page text afterwards. */
async function submitCreate(page: Page, fields: { name: string; email: string; grantNodeId?: string; grantLevel?: string; commandsNodeId?: string }) {
  await page.goto(`${BASE}/access`);
  const form = page.locator('form:has(button:text("צור משתמש"))');
  await form.locator('input[name="name"]').fill(fields.name);
  await form.locator('input[name="email"]').fill(fields.email);
  await form.locator('input[name="password"]').fill(PASSWORD);
  await form.locator('select[name="grantNodeId"]').selectOption(fields.grantNodeId ?? "");
  if (fields.grantLevel) await form.locator('select[name="grantLevel"]').selectOption(fields.grantLevel);
  await form.locator('select[name="commandsNodeId"]').selectOption(fields.commandsNodeId ?? "");
  await form.locator("button").click();
  await page.waitForTimeout(2000);
  return fullText(page);
}

async function main() {
  await cleanup();

  const center = await prisma.orgNode.create({ data: { name: `${TAG} מרכז`, kind: "CENTER" } });
  const domain = await prisma.orgNode.create({ data: { name: `${TAG} תחום`, kind: "DOMAIN", parentId: center.id } });
  const sectionA = await prisma.orgNode.create({ data: { name: `${TAG} מדור א`, kind: "SECTION", parentId: domain.id } });
  const sectionB = await prisma.orgNode.create({ data: { name: `${TAG} מדור ב`, kind: "SECTION", parentId: domain.id } });
  // Free AND out of reach of a מדור ב grant — the two must be separable, or a
  // test of the access guard silently becomes a test of the conflict guard.
  const teamA = await prisma.orgNode.create({ data: { name: `${TAG} צוות א`, kind: "TEAM", parentId: sectionA.id } });

  await prisma.user.create({
    data: {
      name: `${TAG} אדמין`, email: `admin${MAIL}`, username: `${TAG}-admin`,
      passwordHash: hashPassword(PASSWORD), role: "ADMIN",
    },
  });

  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  try {
    const page = await login(ctx, `${TAG}-admin`);

    console.log("\n=== the create form: grant and command together ===");
    await submitCreate(page, { name: `${TAG}-ok`, email: `ok${MAIL}`, grantNodeId: domain.id, grantLevel: "EDIT", commandsNodeId: sectionA.id });
    const ok = await prisma.user.findUnique({ where: { email: `ok${MAIL}` }, include: { grants: true } });
    check("a user created with a covering grant holds the command", ok?.commandsNodeId === sectionA.id, String(ok?.commandsNodeId));
    check("and holds exactly the grant that was asked for", ok?.grants.length === 1 && ok?.grants[0].nodeId === domain.id, `${ok?.grants.length} grants`);
    check("the grant level came through", ok?.grants[0]?.level === "EDIT", ok?.grants[0]?.level);

    console.log("\n=== the guard is wired into createUser ===");
    const text = await submitCreate(page, { name: `${TAG}-bad`, email: `bad${MAIL}`, grantNodeId: sectionB.id, grantLevel: "VIEW", commandsNodeId: teamA.id });
    check("creating with a command outside the grant creates NO user",
      (await prisma.user.count({ where: { email: `bad${MAIL}` } })) === 0);
    const reached = /לא ניתן למנות מפקד/.test(text) && /ההרשאה הראשונה/.test(text);
    check("and the ACCESS refusal — not the conflict one — reaches the browser", reached,
      reached ? "shown on screen" : "MESSAGE NOT FOUND");
    check("no grant was left behind by the failed create",
      (await prisma.accessGrant.count({ where: { nodeId: sectionB.id } })) === 0);

    console.log("\n=== the conflict guard is wired too ===");
    const taken = await submitCreate(page, { name: `${TAG}-dup`, email: `dup${MAIL}`, grantNodeId: domain.id, grantLevel: "VIEW", commandsNodeId: sectionA.id });
    check("a second commander for the same framework creates NO user",
      (await prisma.user.count({ where: { email: `dup${MAIL}` } })) === 0);
    check("and the refusal names the current commander", taken.includes(`${TAG}-ok`),
      taken.includes(`${TAG}-ok`) ? "named on screen" : "HOLDER NOT NAMED");

    console.log("\n=== removeGrant is guarded ===");
    await page.goto(`${BASE}/access?q=${encodeURIComponent(`${TAG}-ok`)}`);
    await page.locator('form:has(button:text("הסר")) button:text("הסר")').first().click();
    await page.waitForTimeout(1500);
    const still = await prisma.accessGrant.count({ where: { userId: ok!.id } });
    check("the covering grant survives the remove attempt", still === 1, `${still} grants`);
    const removeText = await fullText(page);
    check("and the refusal names the commanded framework", /לא ניתן להסיר את ההרשאה/.test(removeText),
      /לא ניתן להסיר את ההרשאה/.test(removeText) ? "shown on screen" : "MESSAGE NOT FOUND");

    console.log("\n=== both pages read it back ===");
    await page.goto(`${BASE}/access?q=${encodeURIComponent(`${TAG}-ok`)}`);
    const accessText = await fullText(page);
    check("the access page shows the commanded framework", accessText.includes("מפקד:"),
      accessText.includes("מפקד:") ? "badge present" : "BADGE MISSING");
    const wantPath = `${TAG} מרכז ▸ ${TAG} תחום ▸ ${TAG} מדור א`;
    check("labelled by its full path", accessText.includes(wantPath), accessText.includes(wantPath) ? wantPath : "PATH MISSING");

    await page.goto(`${BASE}/hierarchy`);
    const treeText = await fullText(page);
    check("the hierarchy tree names the commander beside the framework",
      treeText.includes(`מפקד: ${TAG}-ok`), treeText.includes(`מפקד: ${TAG}-ok`) ? "named in the tree" : "MISSING FROM THE TREE");

    console.log("\n=== clearing through the edit form ===");
    await page.goto(`${BASE}/access?edit=${ok!.id}`);
    const editForm = page.locator('form:has(button:text("שמור"))');
    await editForm.locator('select[name="commandsNodeId"]').selectOption("");
    await editForm.locator('button:text("שמור")').click();
    await page.waitForTimeout(1500);
    const cleared = await prisma.user.findUniqueOrThrow({ where: { id: ok!.id }, include: { grants: true } });
    check("the command is cleared", cleared.commandsNodeId === null, String(cleared.commandsNodeId));
    check("and the grant is untouched by the clearing", cleared.grants.length === 1);

    console.log("\n=== and the grant is removable once the command is gone ===");
    await page.goto(`${BASE}/access?q=${encodeURIComponent(`${TAG}-ok`)}`);
    await page.locator('form:has(button:text("הסר")) button:text("הסר")').first().click();
    await page.waitForTimeout(1500);
    check("the grant removes cleanly", (await prisma.accessGrant.count({ where: { userId: ok!.id } })) === 0);
  } finally {
    await ctx.close();
    await browser.close();
    await cleanup();
    check("no fixtures left behind", (await prisma.user.count({ where: { email: { endsWith: MAIL } } })) === 0);
  }

  if (checks === 0) {
    console.log("\nFAILED — the suite ran ZERO checks");
    process.exitCode = 1;
  } else {
    console.log(failures === 0 ? `\nall ${checks} checks passed` : `\nFAILED — ${checks} ran, ${failures} failed`);
    process.exitCode = failures ? 1 : 0;
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("\nFAILED — the suite crashed:", e);
  await cleanup().catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
