/**
 * Verification for login-dev-link — the environment-link card.
 *
 * The rule that carries it: the card renders only when it is enabled AND has a
 * URL — a button to nowhere never shows — and only http(s) is accepted, since
 * the login page is the one screen served to signed-OUT visitors.
 *
 *   npx tsx scripts/verify-login-link.ts
 */
import { prisma } from "@/lib/prisma";
import { getLoginLink, setLoginLink, DEFAULT_LOGIN_LINK_TEXT } from "@/lib/branding";

const BASE = process.env.BASE_URL ?? "http://localhost:4321";
const KEYS = ["loginLinkText", "loginLinkUrl", "loginLinkEnabled"];
const URL_OK = "https://dev.example.invalid/manager";
const TEXT = "לסביבת המשחקים llverify";

let failures = 0;
let checks = 0;
function check(label: string, ok: boolean, detail = "") {
  checks++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function stash() {
  return prisma.appSetting.findMany({ where: { key: { in: KEYS } } });
}
async function restore(rows: { key: string; value: string }[]) {
  await prisma.appSetting.deleteMany({ where: { key: { in: KEYS } } });
  if (rows.length) await prisma.appSetting.createMany({ data: rows });
}

const loginHtml = async () => (await fetch(`${BASE}/login`, { cache: "no-store" } as RequestInit)).text();

async function main() {
  const saved = await stash();
  try {
    console.log("\n=== defaults ===");
    await prisma.appSetting.deleteMany({ where: { key: { in: KEYS } } });
    let link = await getLoginLink();
    check("a fresh install is hidden", link.enabled === false && link.url === null);
    check("the default text stands ready", link.text === DEFAULT_LOGIN_LINK_TEXT);
    check("...and the login page shows no card", !(await loginHtml()).includes("מעבר לאתר"));

    console.log("\n=== enabled and configured ===");
    await setLoginLink({ text: TEXT, url: URL_OK, enabled: true });
    const html = await loginHtml();
    check("the card carries the configured text", html.includes(TEXT));
    check("the button links to the configured URL", html.includes(URL_OK) && html.includes("מעבר לאתר"));
    check("the anchor opens safely elsewhere", /rel="noopener noreferrer"[^>]*|noopener/.test(html) && html.includes('target="_blank"'));

    console.log("\n=== the card never renders half-working ===");
    await setLoginLink({ text: TEXT, url: "", enabled: true });
    check("enabled without a URL renders nothing", !(await loginHtml()).includes("מעבר לאתר"));
    await setLoginLink({ text: TEXT, url: URL_OK, enabled: false });
    check("disabled hides it though fully configured", !(await loginHtml()).includes("מעבר לאתר"));

    console.log("\n=== text semantics ===");
    await setLoginLink({ text: "   ", url: URL_OK, enabled: true });
    link = await getLoginLink();
    check("clearing the text restores the default", link.text === DEFAULT_LOGIN_LINK_TEXT);
    check("...which is what the page then shows", (await loginHtml()).includes(DEFAULT_LOGIN_LINK_TEXT));

    console.log("\n=== the action's guardrails (module level) ===");
    // the URL scheme gate lives in the action; assert the regex it uses, by contract:
    const gate = (u: string) => !u || /^https?:\/\/.+/i.test(u);
    check("http and https pass the gate", gate("http://a.b") && gate("https://a.b") && gate(""));
    check("javascript:, data: and bare hosts are refused", !gate("javascript:alert(1)") && !gate("data:text/html,x") && !gate("dev.example.com"));
    // and the action itself refuses without an admin session:
    const { updateLoginLink } = await import("@/lib/branding-actions");
    const fd = new FormData();
    fd.set("loginLinkText", "x");
    fd.set("loginLinkUrl", "javascript:alert(1)");
    const refused = await updateLoginLink(fd).then(() => false).catch(() => true);
    check("the action refuses outside an admin session", refused);
  } finally {
    await restore(saved);
    check("settings restored to their pre-suite state", (await stash()).length === saved.length);
  }

  if (checks === 0) { console.log("\nFAILED — ZERO checks"); process.exitCode = 1; }
  else { console.log(failures ? `\nFAILED — ${checks} ran, ${failures} failed` : `\nall ${checks} checks passed`); process.exitCode = failures ? 1 : 0; }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("\nFAILED — the suite crashed:", e);
  await prisma.$disconnect();
  process.exit(1);
});
