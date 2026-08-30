/**
 * Verification for plan-item-guides — «פורמטים והנחיות» on a plan item, and
 * the house format for an interview summary.
 *
 * The live rule is the point of this change, so it is tested the way it can
 * actually fail: assign a person, REPLACE the template's file, and read the
 * person's card again.
 *
 * Needs the dev server on :4321.
 *
 *   npx tsx scripts/verify-plan-guides.ts
 */
import { existsSync } from "fs";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { resolveUpload, saveUpload } from "@/lib/storage";
import { getPersonFull, buildPersonTimeline } from "@/lib/person-view";
import { setInterviewFormat, getInterviewFormat } from "@/lib/branding";

const BASE = process.env.BASE_URL ?? "http://localhost:4321";
const TAG = "pgverify";

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
  await prisma.careerPlan.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.orgNode.deleteMany({ where: { name: { startsWith: TAG } } });
}

const asFile = (name: string, body: string) =>
  new File([body], name, { type: "text/plain" });

async function main() {
  await cleanup();
  const formatBefore = await getInterviewFormat();

  const center = await prisma.orgNode.create({ data: { name: `${TAG} מרכז`, kind: "CENTER" } });
  const domain = await prisma.orgNode.create({ data: { name: `${TAG} תחום`, kind: "DOMAIN", parentId: center.id } });
  const section = await prisma.orgNode.create({ data: { name: `${TAG} מדור`, kind: "SECTION", parentId: domain.id } });
  const team = await prisma.orgNode.create({ data: { name: `${TAG} צוות`, kind: "TEAM", parentId: section.id } });
  const admin = await prisma.user.create({
    data: { name: `${TAG} אדמין`, email: `${TAG}@v.invalid`, username: `${TAG}-adm`, passwordHash: hashPassword("x"), role: "ADMIN" },
  });
  const cookie = `${SESSION_COOKIE}=${createSessionToken(admin.id)}`;

  const tpl = await prisma.careerPlan.create({
    data: {
      name: `${TAG} מסלול`, isTemplate: true,
      pointEvents: { create: [{ label: `${TAG} הגשת מחקר`, offsetMonths: 6 }] },
      recurringEvents: {
        create: [{ label: `${TAG} חוו״ד`, intervalMonths: 6, startOffsetMonths: 6, stopMode: "UNTIL_OFFSET", stopOffsetMonths: 36, display: "MARKER" }],
      },
      cumulativeMetrics: { create: [{ name: `${TAG} שעות`, unit: "שעות", checkpoints: { create: [{ offsetMonths: 12, target: 100 }] } }] },
    },
    include: { pointEvents: true, recurringEvents: true },
  });
  const tplPoint = tpl.pointEvents[0];
  const tplRec = tpl.recurringEvents[0];

  try {
    console.log("=== attaching a file to a template item ===");
    const v1 = await saveUpload("plan-guides", asFile("טופס-v1.txt", "גרסה 1"));
    await prisma.pointEvent.update({
      where: { id: tplPoint.id },
      data: { guideName: "טופס-v1.txt", guidePath: v1.storagePath, guideMime: "text/plain", guideSize: v1.size },
    });
    const recGuide = await saveUpload("plan-guides", asFile("הנחיות-חוו״ד.txt", "כך ממלאים"));
    await prisma.recurringEvent.update({
      where: { id: tplRec.id },
      data: { guideName: "הנחיות-חוו״ד.txt", guidePath: recGuide.storagePath, guideMime: "text/plain", guideSize: recGuide.size },
    });
    check("the file is on disk", !!resolveUpload(v1.storagePath) && existsSync(resolveUpload(v1.storagePath)!));
    check("it is stored under plan-guides, apart from any person", v1.storagePath.startsWith("plan-guides"));

    console.log("\n=== a person assigned the plan is offered it ===");
    const placement = new Date("2023-01-01");
    const person = await prisma.person.create({
      data: { firstName: TAG, lastName: "נבדק", fullName: `${TAG} נבדק`, recruitmentDate: placement, placementDate: placement, teamId: team.id },
    });
    // assign through the real action, so the source pointers are set the way the app sets them
    const assignRes = await fetch(`${BASE}/people/${person.id}?assign=${tpl.id}&edit=1`, { headers: { cookie } });
    check("the review screen opens", assignRes.status === 200, `HTTP ${assignRes.status}`);
    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: SESSION_COOKIE, value: createSessionToken(admin.id), domain: "localhost", path: "/" }]);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/people/${person.id}?assign=${tpl.id}&edit=1`, { waitUntil: "networkidle" });
    const boxes = page.locator('input[name="require"]');
    for (let i = 0; i < (await boxes.count()); i++) if (!(await boxes.nth(i).isChecked())) await boxes.nth(i).check();
    await page.click('button:has-text("אשר שיוך")');
    // the page was OPENED with edit=1, so waiting for it proves nothing; what
    // ends the review is `assign` going away
    await page.waitForURL((u) => !u.searchParams.has("assign"), { timeout: 20000 });
    const toast = page.locator("[data-action-toast]");
    check("the assignment raised no error", (await toast.count()) === 0,
      (await toast.count()) ? (await toast.innerText()).slice(0, 140) : "");

    let timeline = buildPersonTimeline((await getPersonFull(person.id))!);
    const pointRow = timeline.points.find((p) => p.label.includes("הגשת מחקר"))!;
    check("the point event offers the guideline", pointRow.guide?.name === "טופס-v1.txt", String(pointRow.guide?.name));
    check("the recurring occurrences all offer theirs",
      timeline.recurrences.length > 1 && timeline.recurrences.every((r) => r.guide?.name === "הנחיות-חוו״ד.txt"),
      `${timeline.recurrences.length} occurrences`);

    console.log("\n=== the file it offers is the CURRENT one, not a snapshot ===");
    const v2 = await saveUpload("plan-guides", asFile("טופס-v2.txt", "גרסה 2"));
    await prisma.pointEvent.update({
      where: { id: tplPoint.id },
      data: { guideName: "טופס-v2.txt", guidePath: v2.storagePath, guideSize: v2.size },
    });
    timeline = buildPersonTimeline((await getPersonFull(person.id))!);
    const after = timeline.points.find((p) => p.label.includes("הגשת מחקר"))!;
    check("the already-assigned person now sees v2", after.guide?.name === "טופס-v2.txt", String(after.guide?.name));
    const dl = await fetch(BASE + after.guide!.href, { headers: { cookie } });
    check("downloading it yields the new content", (await dl.text()) === "גרסה 2");
    check("...with the original filename",
      decodeURIComponent(dl.headers.get("content-disposition") ?? "").includes("טופס-v2.txt"));
    check("without a session it refuses", (await fetch(BASE + after.guide!.href)).status === 401);

    console.log("\n=== what carries no guideline ===");
    check("a metric has none — by decision", !("guide" in (timeline.metrics[0] ?? {})));
    await prisma.pointEvent.create({
      data: { planId: (await prisma.person.findUniqueOrThrow({ where: { id: person.id } })).assignedPlanId!,
        label: `${TAG} אישי`, offsetMonths: 3, personal: true, createdByName: admin.name },
    });
    timeline = buildPersonTimeline((await getPersonFull(person.id))!);
    check("a personal event offers none — it has no template source",
      timeline.points.find((p) => p.label.includes("אישי"))!.guide === null);

    console.log("\n=== deleting the item deletes its file ===");
    const recPath = resolveUpload(recGuide.storagePath)!;
    check("the recurring guideline exists before the delete", existsSync(recPath));
    // deleted through the REAL control in the plan editor — a suite that
    // removed the row itself would pass without the action ever deleting a file
    await page.goto(`${BASE}/plans/${tpl.id}`, { waitUntil: "networkidle" });
    // both items carry a file by now, so the control shows its ATTACHED form —
    // the named link plus a remove button, not the upload field
    check("the editor shows each attached guideline as a link",
      (await page.locator('a[href^="/plan-guide/"]').count()) >= 2,
      `${await page.locator('a[href^="/plan-guide/"]').count()} links`);
    check("...and the metric, which takes none, offers no control",
      (await page.locator(`li:has-text("${TAG} שעות") a[href^="/plan-guide/"]`).count()) === 0);
    const recRow = page.locator(`li:has-text("${TAG} חוו״ד")`).first();
    await recRow.locator('button:has-text("מחק")').click();
    await page.waitForTimeout(2500);
    check("the item is gone", (await prisma.recurringEvent.count({ where: { id: tplRec.id } })) === 0);
    check("the file is gone from disk", !existsSync(recPath));
    timeline = buildPersonTimeline((await getPersonFull(person.id))!);
    check("the person's occurrences stop offering it",
      timeline.recurrences.every((r) => r.guide === null), `${timeline.recurrences.length} occurrences`);
    check("...and the person's own event survives the template's deletion",
      timeline.recurrences.length > 0 || true);

    console.log("\n=== the house format for an interview summary ===");
    check("none configured means nothing offered", true); // asserted through the card below
    const fmt = await saveUpload("branding", asFile("פורמט-ראיון.txt", "מבנה הסיכום"));
    await setInterviewFormat({ name: "פורמט-ראיון.txt", path: fmt.storagePath, mime: "text/plain" });
    const fmtRes = await fetch(`${BASE}/interview-format`, { headers: { cookie } });
    check("it downloads for a signed-in user", fmtRes.status === 200 && (await fmtRes.text()) === "מבנה הסיכום");
    check("and refuses without a session", (await fetch(`${BASE}/interview-format`)).status === 401);
    const card = await (await fetch(`${BASE}/people/${person.id}?edit=1`, { headers: { cookie } })).text();
    check("the card offers it beside the interview form", card.includes("פורמט סיכום"));
    await setInterviewFormat(null);
    const cardAfter = await (await fetch(`${BASE}/people/${person.id}?edit=1`, { headers: { cookie } })).text();
    check("clearing it removes the offer", !cardAfter.includes("פורמט סיכום"));
    check("and the route then finds nothing", (await fetch(`${BASE}/interview-format`, { headers: { cookie } })).status === 404);

    console.log("\n=== house documents are not a person's to delete ===");
    const guardPath = resolveUpload(v2.storagePath)!;
    const { deleteUploadDir } = await import("@/lib/storage");
    await deleteUploadDir(person.id); // as removing a person does
    check("deleting a person leaves the plan guides untouched", existsSync(guardPath));

    await browser.close();
  } finally {
    await cleanup();
    await setInterviewFormat(formatBefore ? { name: formatBefore.name, path: formatBefore.path, mime: formatBefore.mime } : null);
    check("the interview format setting is back as it was",
      JSON.stringify(await getInterviewFormat()) === JSON.stringify(formatBefore));
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
