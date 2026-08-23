/**
 * Verification for action-error-toasts — refusals travel as state, not crashes.
 *
 * Three layers: the withState adapter's contract (unit), the sweep that proves
 * no bare form site remains (grep-level), and the real browser seeing a toast
 * where an error page used to be (e2e; needs the dev server on :4321).
 *
 *   npx tsx scripts/verify-action-toasts.ts
 */
import { execSync } from "node:child_process";
import { chromium, type Browser, type Page } from "playwright";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { withState } from "@/lib/action-state";

const BASE = process.env.BASE_URL ?? "http://localhost:4321";
const TAG = "atverify";
const PASSWORD = "verify-toasts-1";

let failures = 0;
let checks = 0;
function check(label: string, ok: boolean, detail = "") {
  checks++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function cleanup() {
  await prisma.user.deleteMany({ where: { username: { startsWith: TAG } } });
  await prisma.orgNode.deleteMany({ where: { name: { startsWith: TAG } } });
}

async function main() {
  console.log("=== withState: the adapter's contract ===");
  const fd = new FormData();
  const refused = await withState(async () => {
    throw new Error("סיבה בעברית");
  })(null, fd);
  check("a thrown Error becomes { error } with the message intact",
    refused !== null && "error" in refused && refused.error === "סיבה בעברית");

  const redirecting = withState(async () => {
    const e = new Error("NEXT_REDIRECT") as Error & { digest: string };
    e.digest = "NEXT_REDIRECT;replace;/;303;";
    throw e;
  });
  let rethrown = false;
  try {
    await redirecting(null, fd);
  } catch (e) {
    rethrown = String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
  }
  check("a NEXT_REDIRECT digest is rethrown, not swallowed", rethrown);

  const ok = await withState(async () => {})(null, fd);
  check("success becomes { done }", ok !== null && "done" in ok);

  const blank = await withState(async () => {
    throw new Error("");
  })(null, fd);
  check("a messageless throw still yields a readable reason",
    blank !== null && "error" in blank && blank.error.length > 0);

  console.log("\n=== the sweep: no bare form site remains ===");
  // exempted: ActionForm itself renders the real <form>; the three components
  // with deliberate inline error UI keep their useActionState forms
  // every surviving native <form> element must be either a useFormState form
  // (the three deliberate inline-error components) or plain GET navigation —
  // component props named `action` (ConfirmSubmit, InlineEdit…) are not forms
  const bare = execSync(
    `grep -rn "<form " src/app src/components --include='*.tsx' | grep -v "src/components/ActionForm.tsx" | grep -v 'action={formAction}' | grep -v 'method="get"' || true`,
    { encoding: "utf8" },
  ).trim();
  check("zero bare server-action <form> elements remain", bare === "", bare.split("\n")[0] ?? "");
  const multiline = execSync(
    `grep -rn "<form$" src/app src/components --include='*.tsx' | grep -v "src/components/ActionForm.tsx" || true`,
    { encoding: "utf8" },
  ).trim();
  check("no multi-line <form> opening hides from the sweep", multiline === "", multiline.split("\n")[0] ?? "");
  const forms = execSync(
    `grep -rln "</form>" src/app src/components --include='*.tsx' || true`,
    { encoding: "utf8" },
  ).trim().split("\n").filter(Boolean).sort();
  // allowed: ActionForm renders the real <form>; three components keep their
  // deliberate inline-error forms; GET forms are navigation, not actions
  const allowed = new Set([
    "src/components/ActionForm.tsx", "src/components/DevWipe.tsx",
    "src/components/EmailRunButton.tsx", "src/components/HierarchyTree.tsx",
  ]);
  const count = (f: string, pat: string) =>
    Number(execSync(`grep -c '${pat}' "${f}" || true`, { encoding: "utf8" }).trim() || 0);
  const strays = forms.filter((f) => !allowed.has(f) && count(f, "</form>") !== count(f, '<form method="get"'));
  check("native <form> tags survive only for inline-error UI and GET navigation", strays.length === 0, strays.join(", "));

  console.log("\n=== the browser: a toast where an error page used to be ===");
  await cleanup();
  const center = await prisma.orgNode.create({ data: { name: `${TAG} מרכז`, kind: "CENTER" } });
  await prisma.user.create({
    data: { name: `${TAG} אדמין`, email: `${TAG}@verify.invalid`, username: `${TAG}-adm`, passwordHash: hashPassword(PASSWORD), role: "ADMIN" },
  });
  const browser: Browser = await chromium.launch();
  try {
    const page: Page = await (await browser.newContext()).newPage();

    // the login form now submits through the bridge — its redirects must still work
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="identifier"]', `${TAG}-adm`);
    await page.fill('input[name="password"]', "wrong-password");
    await page.click("form button");
    await page.waitForURL((u) => u.searchParams.has("error"), { timeout: 15000 });
    check("bad credentials still redirect to /login?error=1 through the bridge", true);

    await page.fill('input[name="identifier"]', `${TAG}-adm`);
    await page.fill('input[name="password"]', PASSWORD);
    await page.click("form button");
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });
    check("good credentials still sign in (redirect-after-success intact)", true);

    // a refused action: a TEAM under a CENTER
    await page.goto(`${BASE}/hierarchy`);
    await page.fill("#name", `${TAG} צוות רע`);
    await page.selectOption("#kind", "TEAM");
    await page.selectOption("#parentId", center.id);
    await page.click('button:has-text("הוסף מסגרת")');
    const toast = page.locator("[data-action-toast]");
    await toast.waitFor({ timeout: 15000 });
    check("the refusal pops a toast with the rule's own words",
      (await toast.innerText()).includes("מסגרת אב של צוות חייבת להיות מדור"));
    check("the user is still on the page", page.url().includes("/hierarchy"));
    check("their typed input survived the refusal", (await page.inputValue("#name")) === `${TAG} צוות רע`);
    await page.click("[data-action-toast] button");
    check("the toast dismisses by hand", (await toast.count()) === 0);

    // and the same form still succeeds
    await page.fill("#name", `${TAG} תחום טוב`);
    await page.selectOption("#kind", "DOMAIN");
    await page.selectOption("#parentId", center.id);
    await page.click('button:has-text("הוסף מסגרת")');
    await page.waitForFunction(() => (document.getElementById("name") as HTMLInputElement)?.value === "", undefined, { timeout: 15000 });
    check("a good submit still works, resetting the form", (await prisma.orgNode.count({ where: { name: `${TAG} תחום טוב` } })) === 1);
    check("no toast on success", (await toast.count()) === 0);
  } finally {
    await browser.close();
    await cleanup();
    const residue = (await prisma.user.count({ where: { username: { startsWith: TAG } } })) +
      (await prisma.orgNode.count({ where: { name: { startsWith: TAG } } }));
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
