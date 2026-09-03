/**
 * Verification for org-tree-import.
 *
 * The act being guarded is the most destructive in the application: replacing
 * the tree cascades every access grant and every query away. So the suite
 * proves twice over that nothing is written while a fault stands, and it reads
 * the real cost back from the database rather than trusting the confirmation's
 * wording.
 *
 * Needs the dev server on :4321.
 *
 *   npx tsx scripts/verify-org-import.ts
 */
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { parseTable } from "@/lib/hr-import";
import { recognizeOrgHeaders, validateOrgRows, planAsTree, type OrgMapping } from "@/lib/org-import";
import { buildFullZip, importBundleBuffer } from "@/lib/portability";

const BASE = process.env.BASE_URL ?? "http://localhost:4321";
const TAG = "oiverify";

let failures = 0;
let checks = 0;
function check(label: string, ok: boolean, detail = "") {
  checks++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

/** A sheet as a buffer, the way a real upload arrives. */
function sheet(rows: string[][], kind: "xlsx" | "csv" = "xlsx"): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "עץ");
  return XLSX.write(wb, { type: "buffer", bookType: kind });
}

const HEAD = ["שם המסגרת", "סוג המסגרת", "מסגרת אב"];
const GOOD: string[][] = [
  HEAD,
  [`${TAG} מרכז`, "מרכז", ""],
  [`${TAG} תחום`, "תחום", `${TAG} מרכז`],
  [`${TAG} מדור`, "מדור", `${TAG} תחום`],
  [`${TAG} אלפא`, "צוות", `${TAG} מדור`],
  [`${TAG} בטא`, "צוות", `${TAG} מדור`],
];

/** Parse + recognise + validate, the way the actions chain them. */
function run(rows: string[][], mapping?: OrgMapping) {
  const parsed = parseTable(sheet(rows), "t.xlsx");
  const m = mapping ?? recognizeOrgHeaders(parsed.headers);
  return { parsed, mapping: m, ...validateOrgRows(parsed, m) };
}

/** A file that is good except for one substituted row. */
const withRow = (i: number, row: string[]) => GOOD.map((r, idx) => (idx === i ? row : r));

async function main() {
  console.log("backing the database up through portability…");
  const backup = await buildFullZip();

  try {
    console.log("\n=== parsing and column mapping ===");
    const asXlsx = parseTable(sheet(GOOD, "xlsx"), "t.xlsx");
    const asCsv = parseTable(sheet(GOOD, "csv"), "t.csv");
    check("an .xlsx and a .csv of the same content read alike",
      JSON.stringify(asXlsx.rows) === JSON.stringify(asCsv.rows));

    const foreign = [["Unit", "Level", "Reports To", "הערות"], [`${TAG} מרכז`, "מרכז", "", "לא רלוונטי"]];
    const proposed = recognizeOrgHeaders(parseTable(sheet(foreign), "t.xlsx").headers);
    check("foreign headers are recognised",
      proposed[0].target === "name" && proposed[1].target === "kind" && proposed[2].target === "parent",
      proposed.map((c) => c.target).join(", "));
    check("an unrecognised column is ignored, never guessed at", proposed[3].target === "ignore");

    console.log("\n=== validation follows the APPROVED mapping ===");
    // two candidate columns for the parent; the admin points at the second
    const twoParents = [
      ["שם המסגרת", "סוג המסגרת", "מסגרת אב", "אב חלופי"],
      [`${TAG} מרכז`, "מרכז", "", ""],
      [`${TAG} תחום`, "תחום", "לא קיים", `${TAG} מרכז`],
    ];
    const proposedTwo = recognizeOrgHeaders(parseTable(sheet(twoParents), "t.xlsx").headers);
    check("the first column to claim a meaning keeps it", proposedTwo[2].target === "parent" && proposedTwo[3].target === "ignore");
    const asProposed = run(twoParents, proposedTwo);
    check("as proposed, the bad parent column produces a fault", asProposed.faults.length === 1,
      asProposed.faults[0]?.reason);
    const repointed: OrgMapping = [
      { header: "שם המסגרת", target: "name" },
      { header: "סוג המסגרת", target: "kind" },
      { header: "מסגרת אב", target: "ignore" },
      { header: "אב חלופי", target: "parent" },
    ];
    const asApproved = run(twoParents, repointed);
    check("re-pointed at the other column, the same file is clean", asApproved.faults.length === 0,
      asApproved.faults.map((f) => f.reason).join(" | "));

    const missing: OrgMapping = [
      { header: "שם המסגרת", target: "name" },
      { header: "סוג המסגרת", target: "ignore" },
      { header: "מסגרת אב", target: "parent" },
    ];
    const noKind = run(GOOD, missing);
    check("a meaning left unmapped is reported before any row is read",
      noKind.faults.length === 1 && noKind.faults[0].row === null && noKind.faults[0].reason.includes("סוג המסגרת"),
      noKind.faults[0]?.reason);

    console.log("\n=== every fault is named, by row ===");
    const cases: [string, string[][], string][] = [
      ["an unknown kind", withRow(4, [`${TAG} אלפא`, "ענף", `${TAG} מדור`]), "סוג לא מוכר"],
      ["a parent that appears nowhere", withRow(4, [`${TAG} אלפא`, "צוות", "מדור שלא קיים"]), "אינה מופיעה"],
      ["a team under a domain", withRow(4, [`${TAG} אלפא`, "צוות", `${TAG} תחום`]), "חייב להיות"],
      ["a non-center root", withRow(1, [`${TAG} מרכז`, "תחום", ""]), "חייב מסגרת אב"],
      ["a center given a parent", withRow(4, [`${TAG} אלפא`, "מרכז", `${TAG} מדור`]), "אינו יכול להיות תחת"],
      ["two siblings of one name", [...GOOD, [`${TAG} אלפא`, "צוות", `${TAG} מדור`]], "כבר קיים"],
      ["a missing name", withRow(4, ["", "צוות", `${TAG} מדור`]), "חסר שם"],
    ];
    for (const [label, rows, expect] of cases) {
      const r = run(rows);
      check(`${label} is reported`, r.faults.some((f) => f.reason.includes(expect)),
        r.faults.map((f) => f.reason).join(" | ").slice(0, 90));
      check(`...and yields no plan`, r.plan.length === 0);
    }

    // A file with no data rows never reaches the validator: parseTable drops
    // blank rows and then refuses anything under two rows, so the admin's
    // message comes from there. The validator keeps its own empty guard for its
    // contract's sake, so it is checked directly rather than through a file.
    const emptyDirect = validateOrgRows({ headers: HEAD, rows: [] }, recognizeOrgHeaders(HEAD));
    check("the validator guards its own contract against no rows",
      emptyDirect.faults.some((f) => f.reason.includes("אינו מכיל שורות")) && emptyDirect.plan.length === 0);
    let parseRefusal = "";
    try {
      parseTable(sheet([HEAD]), "t.xlsx");
    } catch (e) {
      parseRefusal = e instanceof Error ? e.message : "";
    }
    check("a header-only file is refused when it is read", parseRefusal.includes("פחות משתי שורות"), parseRefusal);

    const ambiguous = [...GOOD, [`${TAG} מדור`, "מדור", `${TAG} תחום`]];
    const amb = run(ambiguous);
    check("an ambiguous parent name is a fault, not a guess",
      amb.faults.some((f) => f.reason.includes("מופיע")), amb.faults[0]?.reason);

    const cyclic = [HEAD, ["א", "תחום", "ב"], ["ב", "תחום", "א"]];
    check("a parent chain that closes on itself is caught",
      run(cyclic).faults.some((f) => f.reason.includes("חוזרת אל עצמה")));

    console.log("\n=== a clean file plans the tree, roots first ===");
    const good = run(GOOD);
    check("no faults", good.faults.length === 0, good.faults.map((f) => f.reason).join(" | "));
    check("every row is planned", good.plan.length === 5, `${good.plan.length}`);
    check("parents come before their children",
      good.plan.every((n, i) => !n.parentName || good.plan.findIndex((p) => p.name === n.parentName) < i));
    const tree = planAsTree(good.plan);
    check("the plan draws as one tree", tree.length === 1 && tree[0].children[0]?.children[0]?.children.length === 2);

    console.log("\n=== applying it: the cost is real, and it is paid in full ===");
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" }, select: { id: true, name: true } });
    const cookie = `${SESSION_COOKIE}=${createSessionToken(admin.id)}`;
    const { orgImportCost, applyOrgImport } = await import("@/lib/org-actions");
    void applyOrgImport; // called through the browser below, where a session exists

    const before = await orgImportCost();
    check("the cost is read from the database, not described",
      before.frameworks === (await prisma.orgNode.count()) &&
      before.grants === (await prisma.accessGrant.count()) &&
      before.queries === (await prisma.query.count()),
      `${before.frameworks} frameworks · ${before.grants} grants · ${before.queries} queries`);
    check("the fixture actually has something to lose", before.frameworks > 0 && before.grants > 0,
      "otherwise the replacement checks below prove nothing");

    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: SESSION_COOKIE, value: createSessionToken(admin.id), domain: "localhost", path: "/" }]);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/hierarchy`, { waitUntil: "networkidle" });
    await page.setInputFiles('input[type="file"]', { name: "tree.xlsx", mimeType: "application/vnd.ms-excel", buffer: sheet(GOOD) });
    await page.click('button:has-text("העלה וקרא")');
    await page.waitForSelector('button:has-text("אשר התאמה")', { timeout: 20000 });
    check("the mapping step is offered", true);
    await page.click('button:has-text("אשר התאמה")');
    await page.waitForSelector('button:has-text("החלף את העץ הקיים"), button:has-text("צור את העץ")', { timeout: 20000 });
    check("a clean file reaches the replace step", true);
    check("nothing has been written yet", (await prisma.orgNode.count()) === before.frameworks,
      `${await prisma.orgNode.count()} vs ${before.frameworks}`);

    await page.click('button:has-text("החלף את העץ הקיים"), button:has-text("צור את העץ")');
    await page.waitForSelector("text=יימחקו", { timeout: 10000 });
    const warning = await page.locator("text=יימחקו").locator("xpath=ancestor::form").innerText();
    check("the warning names the grants that will go", warning.includes(`${before.grants} הרשאות`), warning.slice(0, 80));
    check("...and the queries", warning.includes(`${before.queries} שאילתות`));
    check("...and the people who will be left unassigned", warning.includes(`${before.peopleUnassigned} אנשים`));
    check("still nothing written while the warning stands", (await prisma.orgNode.count()) === before.frameworks);

    await page.click('button:has-text("אשר החלפה")');
    await page.waitForSelector("text=העץ יובא בהצלחה", { timeout: 30000 });
    await browser.close();

    const after = await prisma.orgNode.findMany({ select: { name: true, kind: true, parentId: true } });
    check("the tree is exactly the file's", after.length === 5 && after.every((n) => n.name.startsWith(TAG)), `${after.length} nodes`);
    check("the grants are gone with it", (await prisma.accessGrant.count()) === 0);
    check("the queries too", (await prisma.query.count()) === 0);
    check("no commander remains appointed", (await prisma.user.count({ where: { commandsNodeId: { not: null } } })) === 0);
    check("the people survive, without a framework",
      (await prisma.person.count()) > 0 && (await prisma.person.count({ where: { teamId: { not: null } } })) === 0,
      `${await prisma.person.count()} people, none placed`);
    check("the import is recorded", (await prisma.activityLog.count({ where: { action: "org.import" } })) >= 1);
  } finally {
    console.log("\nrestoring the database from the portability backup…");
    const restored = await importBundleBuffer(backup);
    check("the backup restored", restored.scope === "full" && (await prisma.orgNode.count()) > 0);
    check("no imported fixtures remain", (await prisma.orgNode.count({ where: { name: { startsWith: TAG } } })) === 0);
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
