/**
 * E2E for bulk-person-intake (tasks 3.1–3.5), against the dev server with the
 * real agent CLI. Slow by nature — every readable file is a real extraction.
 *
 * Batch under test:
 *   match.txt      exact name of an existing person  → proposals on them
 *   fresh.txt      a name nobody has                 → new-person draft
 *   garbage.bin    unreadable                        → FAILED, others unaffected
 *   ambiguous.txt  a name TWO people share           → draft, never an update
 */
import { writeFile, mkdir, rm } from "fs/promises";
import path from "path";
import { chromium, type BrowserContext } from "playwright";
import { prisma } from "../src/lib/prisma";
import { INTAKE_NEW_PERSON_LABEL, intakeUpdateLabel } from "../src/lib/intake-labels";
import { hashPassword } from "../src/lib/password";

const BASE = process.env.BASE_URL ?? "http://localhost:4321";
const PASSWORD = "verify-intake-1234";
const DIR = "/tmp/claude-1000/-home-omer-Projects-manager/de9743d3-ec83-43e1-ba9e-acb0b0b65de6/scratchpad/intake-files";

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
  await page.click("form button");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });
  return page;
}

function personDoc(first: string, last: string, extra = "") {
  return `כרטיס עובד\nשם פרטי: ${first}\nשם משפחה: ${last}\nתאריך לידה: 1994-05-01\nתאריך גיוס: 2022-03-01\n${extra}`;
}

async function main() {
  const admin = await prisma.user.create({
    data: { username: "verify.intake", email: "vi@example.invalid", name: "בודק", role: "ADMIN", passwordHash: hashPassword(PASSWORD) },
  });
  const manager = await prisma.user.create({
    data: { username: "verify.intake.mgr", email: "vim@example.invalid", name: "מנהל", role: "MANAGER", passwordHash: hashPassword(PASSWORD) },
  });
  // two people sharing a name — the ambiguity case
  const team = await prisma.orgNode.findFirst({ where: { kind: "TEAM" } });
  const twinData = {
    firstName: "תאום", lastName: "כפול", fullName: "תאום כפול",
    birthDate: new Date("1990-01-01"), recruitmentDate: new Date("2020-01-01"), placementDate: new Date("2020-01-01"), teamId: team?.id ?? null,
  };
  const twin1 = await prisma.person.create({ data: twinData });
  const twin2 = await prisma.person.create({ data: twinData });

  const target = await prisma.person.findFirstOrThrow({
    where: { fullName: "אדוה זילברמן" },
    select: { id: true, firstName: true, lastName: true },
  });

  await mkdir(DIR, { recursive: true });
  await writeFile(path.join(DIR, "match.txt"), personDoc(target.firstName, target.lastName, "תאריך סיום שירות: 2028-06-30\n"));
  await writeFile(path.join(DIR, "fresh.txt"), personDoc("נועם", "בדיקתי"));
  await writeFile(path.join(DIR, "garbage.bin"), Buffer.from([0x00, 0x01, 0xff, 0xfe, 0x03, 0x99]));
  await writeFile(path.join(DIR, "ambiguous.txt"), personDoc("תאום", "כפול"));

  const browser = await chromium.launch();
  let crashed: unknown = null;
  const t0 = Date.now();
  try {
    // ---- 3.4 first: non-admin is locked out (cheap, no agent) ----
    console.log("\n=== 3.4 authorization ===");
    const mgrCtx = await browser.newContext();
    const mgr = await login(mgrCtx, "verify.intake.mgr");
    await mgr.goto(`${BASE}/people`);
    check("no dropzone for a manager", (await mgr.locator('input[name="documents"]').count()) === 0);
    await mgr.goto(`${BASE}/people/intake`);
    await mgr.waitForTimeout(800);
    check("/people/intake redirects away (moved onto /people)", !mgr.url().includes("/intake"), mgr.url());

    // ---- the batch ----
    console.log("\n=== 3.1/3.2 the batch (real agent runs — patience) ===");
    const ctx = await browser.newContext();
    const page = await login(ctx, "verify.intake");
    await page.goto(`${BASE}/people`);
    await page.setInputFiles('input[name="documents"]', [
      path.join(DIR, "match.txt"),
      path.join(DIR, "fresh.txt"),
      path.join(DIR, "garbage.bin"),
      path.join(DIR, "ambiguous.txt"),
    ]);
    await page.getByRole("button", { name: "התחל קליטה" }).click();
    await page.waitForURL((u) => u.pathname.endsWith("/people"), { timeout: 15000 });
    await page.waitForTimeout(1500);
    const early = (await page.locator("body").textContent()) ?? "";
    check("all four files appear in the queue at once", ["match.txt", "fresh.txt", "garbage.bin", "ambiguous.txt"].every((f) => early.includes(f)));

    // ---- 3.3 reviewable-as-ready: poll until SOME item is done while ANOTHER still runs ----
    let sawPartial = false;
    for (let i = 0; i < 150; i++) {
      const runs = await prisma.agentRun.findMany({ where: { userId: admin.id, kind: "INTAKE" } });
      const done = runs.filter((r) => r.status !== "RUNNING").length;
      if (done > 0 && done < runs.length) { sawPartial = true; break; }
      if (done === runs.length && runs.length === 4) break;
      await new Promise((r) => setTimeout(r, 2000));
    }
    console.log(`  (partial-completion window observed: ${sawPartial})`);

    // wait for the whole batch
    for (let i = 0; i < 240; i++) {
      const live = await prisma.agentRun.count({ where: { userId: admin.id, kind: "INTAKE", status: "RUNNING" } });
      if (live === 0) break;
      await new Promise((r) => setTimeout(r, 3000));
    }
    const runs = await prisma.agentRun.findMany({ where: { userId: admin.id, kind: "INTAKE" }, orderBy: { createdAt: "asc" } });
    console.log(`  batch finished in ${Math.round((Date.now() - t0) / 1000)}s`);
    for (const r of runs) console.log(`    ${r.prompt}: ${r.status} → ${r.output ?? r.error?.slice(0, 60)}`);

    const byName = new Map(runs.map((r) => [r.prompt, r]));
    const match = byName.get("match.txt");
    check("match.txt → proposals on the existing person", match?.status === "SUCCEEDED" && match.output === `person:${target.id}`, match?.output ?? match?.error ?? "");
    const proposal = await prisma.extractionProposal.findFirst({ where: { personId: target.id } });
    check("an open proposal exists on them", proposal !== null);

    const fresh = byName.get("fresh.txt");
    check("fresh.txt → a new-person draft", fresh?.status === "SUCCEEDED" && (fresh.output?.startsWith("draft:") ?? false), fresh?.output ?? fresh?.error ?? "");

    const garbage = byName.get("garbage.bin");
    check("garbage.bin → FAILED with a reason", garbage?.status === "FAILED" && !!garbage.error, garbage?.error?.slice(0, 60) ?? "");
    check("the bad file did not sink the others", match?.status === "SUCCEEDED" && fresh?.status === "SUCCEEDED");

    const amb = byName.get("ambiguous.txt");
    check("ambiguous.txt → a draft, not an update to either twin", amb?.status === "SUCCEEDED" && (amb.output?.startsWith("draft:") ?? false), amb?.output ?? amb?.error ?? "");
    const twinProposals = await prisma.extractionProposal.count({ where: { personId: { in: [twin1.id, twin2.id] } } });
    check("neither twin got proposals", twinProposals === 0);

    // ---- queue links ----
    await page.reload();
    const text = (await page.locator("body").textContent()) ?? "";
    check("queue links an update to the matched person by name", text.includes(intakeUpdateLabel("אדוה זילברמן")));
    check("queue links the new-person draft", text.includes(INTAKE_NEW_PERSON_LABEL));

    // ---- 3.3 complete an approval from the queue ----
    console.log("\n=== 3.3 approving a ready item ===");
    await page.getByRole("link", { name: INTAKE_NEW_PERSON_LABEL }).first().click();
    await page.waitForURL((u) => u.pathname.endsWith("/people/new"), { timeout: 15000 });
    const prefilled = await page.locator('input[name="firstName"]').inputValue();
    check("the form is prefilled from the document", prefilled.length > 0, prefilled);

    // ---- 3.5 the single-file guard is scoped to EXTRACT ----
    console.log("\n=== 3.5 the single-flow guard ignores INTAKE runs ===");
    await prisma.agentRun.updateMany({ where: { userId: admin.id, kind: "INTAKE", prompt: "match.txt" }, data: { status: "RUNNING" } });
    const { hasLiveRun } = await import("../src/lib/jobs");
    check("a live INTAKE run does not trip the EXTRACT guard",
      !(await hasLiveRun({ userId: admin.id, kind: "EXTRACT", personId: null })));
    await prisma.agentRun.updateMany({ where: { userId: admin.id, kind: "INTAKE", prompt: "match.txt" }, data: { status: "SUCCEEDED" } });
  } catch (e) {
    crashed = e;
  } finally {
    await browser.close();
    // teardown: runs, proposals, drafts, twins, the fresh person if approved, users, files
    const runs = await prisma.agentRun.findMany({ where: { userId: admin.id, kind: "INTAKE" } });
    const draftIds = runs.map((r) => (r.output?.startsWith("draft:") ? r.output.slice(6) : null)).filter((v): v is string => !!v);
    await prisma.personDraft.deleteMany({ where: { id: { in: draftIds } } });
    await prisma.extractionProposal.deleteMany({ where: { personId: { in: ["", twin1.id, twin2.id] } } });
    const target2 = await prisma.person.findFirst({ where: { fullName: "אדוה זילברמן" }, select: { id: true } });
    if (target2) await prisma.extractionProposal.deleteMany({ where: { personId: target2.id } });
    await prisma.person.deleteMany({ where: { id: { in: [twin1.id, twin2.id] } } });
    await prisma.person.deleteMany({ where: { fullName: "נועם בדיקתי" } });
    await prisma.user.deleteMany({ where: { id: { in: [admin.id, manager.id] } } });
    await rm(DIR, { recursive: true, force: true });
    if (crashed) console.error("\nRUN CRASHED:", crashed instanceof Error ? crashed.stack : crashed);
    const clean = !crashed && failures === 0 && checksRun > 0;
    console.log(clean ? `\nall ${checksRun} checks passed` : `\nFAILED — ${checksRun} ran, ${failures} failed${crashed ? ", crashed" : ""}`);
    await prisma.$disconnect();
    process.exit(clean ? 0 : 1);
  }
}

main();
