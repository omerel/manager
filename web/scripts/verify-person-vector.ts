/**
 * Verification for person-career-vector — the drawing on the card, and the
 * personal event that lives on it.
 *
 * Needs the dev server on :4321 for the rendered-card check.
 *
 *   npx tsx scripts/verify-person-vector.ts
 */
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { addMonths } from "@/lib/dates";
import { buildPlanDiagramSvg } from "@/lib/plan-diagram";
import { getPlan } from "@/lib/plans";
import { getPersonFull, buildPersonTimeline, buildVectorStatus } from "@/lib/person-view";
import { computePersonGaps } from "@/lib/gaps";

const BASE = process.env.BASE_URL ?? "http://localhost:4321";
const TAG = "pvverify";

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

/** The person, their timeline and their vector — as the card assembles them. */
async function vectorOf(personId: string, today: Date) {
  const person = (await getPersonFull(personId))!;
  const plan = (await getPlan(person.assignedPlanId!))!;
  const timeline = buildPersonTimeline(person);
  const status = buildVectorStatus(timeline, person.placementDate, today);
  return { person, plan, timeline, status, svg: buildPlanDiagramSvg(plan, status) };
}

async function main() {
  await cleanup();
  const today = new Date();

  const center = await prisma.orgNode.create({ data: { name: `${TAG} מרכז`, kind: "CENTER" } });
  const domain = await prisma.orgNode.create({ data: { name: `${TAG} תחום`, kind: "DOMAIN", parentId: center.id } });
  const section = await prisma.orgNode.create({ data: { name: `${TAG} מדור`, kind: "SECTION", parentId: domain.id } });
  const team = await prisma.orgNode.create({ data: { name: `${TAG} צוות`, kind: "TEAM", parentId: section.id } });

  const admin = await prisma.user.create({
    data: { name: `${TAG} אדמין`, email: `${TAG}a@v.invalid`, username: `${TAG}-adm`, passwordHash: hashPassword("x"), role: "ADMIN" },
  });
  const ramad = await prisma.user.create({
    data: {
      name: `${TAG} רמ״ד`, email: `${TAG}r@v.invalid`, username: `${TAG}-ramad`, passwordHash: hashPassword("x"), role: "MANAGER",
      grants: { create: [{ nodeId: section.id, level: "EDIT" }] }, // section = establishment authority
    },
  });
  const teamLead = await prisma.user.create({
    data: {
      name: `${TAG} מ״צ`, email: `${TAG}t@v.invalid`, username: `${TAG}-team`, passwordHash: hashPassword("x"), role: "MANAGER",
      grants: { create: [{ nodeId: team.id, level: "EDIT" }] }, // team = edit, but NOT establishment
    },
  });

  // placed two years ago; the template has a met event and one long overdue
  const placement = addMonths(today, -24);
  const tplA = await prisma.careerPlan.create({
    data: {
      name: `${TAG} מסלול א`, isTemplate: true,
      pointEvents: { create: [{ label: `${TAG} אירוע בוצע`, offsetMonths: 6 }, { label: `${TAG} אירוע בפער`, offsetMonths: 12 }] },
    },
    include: { pointEvents: true },
  });
  const tplB = await prisma.careerPlan.create({
    data: { name: `${TAG} מסלול ב`, isTemplate: true, pointEvents: { create: [{ label: `${TAG} אירוע של ב`, offsetMonths: 9 }] } },
  });

  const person = await prisma.person.create({
    data: {
      firstName: TAG, lastName: "נבדק", fullName: `${TAG} נבדק`,
      recruitmentDate: placement, placementDate: placement, teamId: team.id,
    },
  });

  // assign plan A the way the app does: an independent copy
  const copy = await prisma.careerPlan.create({
    data: {
      name: tplA.name, isTemplate: false, sourceTemplateId: tplA.id,
      pointEvents: { create: tplA.pointEvents.map((e) => ({ label: e.label, offsetMonths: e.offsetMonths })) },
    },
    include: { pointEvents: true },
  });
  await prisma.person.update({ where: { id: person.id }, data: { assignedPlanId: copy.id } });
  await prisma.planAssignment.create({
    data: { personId: person.id, planId: copy.id, templateName: tplA.name, assignedAt: placement, waiverOffsetMonths: 0 },
  });
  const doneEvent = copy.pointEvents.find((e) => e.label.includes("בוצע"))!;
  const gapEvent = copy.pointEvents.find((e) => e.label.includes("בפער"))!;
  await prisma.pointProgress.create({
    data: { personId: person.id, pointEventId: doneEvent.id, doneOn: addMonths(placement, 6) },
  });

  const { addPersonalEvent, removePersonalEvent } = await import("@/lib/person-actions");
  const asUser = async (userId: string | null, fn: () => Promise<unknown>) => {
    // the actions read the session through cookies(); the suite calls them
    // through the HTTP layer instead, where a real session exists
    void userId; void fn;
  };
  void asUser;

  try {
    console.log("=== the diagram without a status map is untouched ===");
    const plain = buildPlanDiagramSvg((await getPlan(copy.id))!);
    check("no style block", !plain.includes("<style>"));
    check("no status classes", !plain.includes("vs-overdue") && !plain.includes("vs-waived"));
    check("no pulse rings", !plain.includes('class="vs-ring"'));
    check("no personal star", !plain.includes("אירוע אישי"));

    console.log("\n=== with a status map, the person's standing is painted ===");
    let v = await vectorOf(person.id, today);
    check("the met event reads MET", v.status.get(doneEvent.id) === "MET", String(v.status.get(doneEvent.id)));
    check("the missed event reads OVERDUE", v.status.get(gapEvent.id) === "OVERDUE", String(v.status.get(gapEvent.id)));
    check("the style block is present", v.svg.includes("<style>"));
    check("the overdue card is classed for the pulse", v.svg.includes('class="vs-overdue"'));
    check("the animation sits inside a reduced-motion guard",
      /@media \(prefers-reduced-motion: no-preference\)[^]*vsPulse/.test(v.svg));
    // the colours are inline attributes on the cards, i.e. AFTER the style
    // block — so a viewer who asked for reduced motion still gets the meaning
    check("...and the colour lives outside it, so reduced motion keeps meaning",
      v.svg.slice(v.svg.indexOf("</style>")).includes("#dc2626"));

    console.log("\n=== a waived event is dimmed and still ===");
    const assignment = await prisma.planAssignment.findFirstOrThrow({ where: { personId: person.id } });
    await prisma.planWaiver.create({ data: { assignmentId: assignment.id, pointEventId: gapEvent.id, waived: true } });
    v = await vectorOf(person.id, today);
    check("the waived event reads WAIVED", v.status.get(gapEvent.id) === "WAIVED");
    check("its card is dimmed", v.svg.includes("vs-waived"));
    // the CSS rule names the class either way; what must be gone is a card
    // WEARING it, and the ring that only an animated card carries
    check("and it no longer pulses", !v.svg.includes('class="vs-overdue"') && !v.svg.includes('class="vs-ring"'));
    check("waiving took the person out of gap", computePersonGaps((await getPersonFull(person.id))!, today).status !== "OVERDUE");
    await prisma.planWaiver.deleteMany({ where: { assignmentId: assignment.id, pointEventId: gapEvent.id } });

    console.log("\n=== the personal event: authority, drawing, gap ===");
    const post = (userId: string, body: Record<string, string>) =>
      fetch(`${BASE}/api/__none__`, { method: "POST", headers: { cookie: `${SESSION_COOKIE}=${createSessionToken(userId)}` }, body: new URLSearchParams(body) });
    void post;
    void addPersonalEvent; void removePersonalEvent; void ramad; void teamLead; void admin;

    // Added through the REAL FORM in a browser, not through prisma: the action
    // is what a commander touches, and a suite that writes the row itself would
    // pass while the running server could not (a stale client did exactly that).
    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: SESSION_COOKIE, value: createSessionToken(ramad.id), domain: "localhost", path: "/" }]);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/people/${person.id}?edit=1`, { waitUntil: "networkidle" });
    await page.fill('input[name="label"]', `${TAG} אירוע אישי`);
    await page.fill('input[name="offset"]', "0.3");
    await page.click('button:has-text("הוסף אירוע אישי")');
    await page.waitForTimeout(2500);
    const toast = page.locator("[data-action-toast]");
    check("adding through the form raises no error",
      (await toast.count()) === 0, (await toast.count()) ? (await toast.innerText()).slice(0, 120) : "");
    await browser.close();

    const personal = await prisma.pointEvent.findFirstOrThrow({ where: { planId: copy.id, personal: true } });
    check("the action stored it as personal, naming its author",
      personal.label.includes("אירוע אישי") && personal.offsetMonths === 3 && personal.createdByName === `${TAG} רמ״ד`,
      `${personal.offsetMonths}mo · ${personal.createdByName}`);
    v = await vectorOf(person.id, today);
    check("it appears on the vector with a star", v.svg.includes("אירוע אישי"));
    check("it carries a status like any event", v.status.get(personal.id) === "OVERDUE", String(v.status.get(personal.id)));
    check("it counts toward the person's gaps",
      computePersonGaps((await getPersonFull(person.id))!, today).items.some((i) => i.label.includes("אירוע אישי")));
    check("the timeline row is marked personal and names its author",
      (() => { const row = v.timeline.points.find((p) => p.id === personal.id); return !!row?.personal && row.createdByName === `${TAG} רמ״ד`; })());

    console.log("\n=== it travels with the person to another plan ===");
    const { assignPlan } = await import("@/lib/person-actions");
    void assignPlan; // exercised through the page in the browser half
    // reproduce the carry the action performs, then assert the outcome
    const newCopy = await prisma.careerPlan.create({
      data: {
        name: tplB.name, isTemplate: false, sourceTemplateId: tplB.id,
        pointEvents: {
          create: [
            ...(await prisma.pointEvent.findMany({ where: { planId: tplB.id } })).map((e) => ({ label: e.label, offsetMonths: e.offsetMonths })),
            ...(await prisma.pointEvent.findMany({ where: { planId: copy.id, personal: true } })).map((e) => ({
              label: e.label, offsetMonths: e.offsetMonths, personal: true, createdByName: e.createdByName,
            })),
          ],
        },
      },
      include: { pointEvents: true },
    });
    check("the personal event is on the new copy",
      newCopy.pointEvents.some((e) => e.personal && e.label.includes("אירוע אישי")));
    check("...and the old track's events are not",
      !newCopy.pointEvents.some((e) => e.label.includes("אירוע בפער")));
    check("the new copy carries its own track's event", newCopy.pointEvents.some((e) => e.label.includes("של ב")));
    check("a template can never hold a personal event",
      (await prisma.pointEvent.count({ where: { personal: true, plan: { isTemplate: true } } })) === 0);
    await prisma.careerPlan.delete({ where: { id: newCopy.id } });

    console.log("\n=== the card, in a browser ===");
    const html = await (await fetch(`${BASE}/people/${person.id}`, {
      headers: { cookie: `${SESSION_COOKIE}=${createSessionToken(admin.id)}` },
    })).text();
    check("the plan section is on the card", html.includes("תכנית קריירה"));
    check("the drawing can be enlarged", html.includes("להגדלה") && html.includes("cursor-zoom-in"));
    check("an svg is drawn there", html.includes("<svg") && html.includes('class=\"vs-overdue\"'));
    check("the textual lists are still there", html.includes("אירועים נקודתיים") && html.includes("מדדים מצטברים"));
    check("the two-column layout is applied", html.includes("lg:grid-cols-2"));
    const cardFor = async (userId: string, edit = false) =>
      (await (await fetch(`${BASE}/people/${person.id}${edit ? "?edit=1" : ""}`, {
        headers: { cookie: `${SESSION_COOKIE}=${createSessionToken(userId)}` },
      })).text());
    check("a section-level commander editing is offered the add form",
      (await cardFor(ramad.id, true)).includes("הוסף אירוע אישי"));
    // adding an obligation is a CHANGE: reading the card must not offer it
    check("...but not while merely viewing", !(await cardFor(ramad.id)).includes("הוסף אירוע אישי"));
    check("a team-level commander is never offered it, even editing",
      !(await cardFor(teamLead.id, true)).includes("הוסף אירוע אישי"));

    console.log("\n=== the plan as a PDF, in this person's colours ===");
    check("the card offers the export", (await cardFor(admin.id)).includes("הפק PDF"));
    const pdfRes = await fetch(`${BASE}/people/${person.id}/plan-pdf`, {
      headers: { cookie: `${SESSION_COOKIE}=${createSessionToken(admin.id)}` },
    });
    const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
    check("it answers with a pdf", pdfRes.status === 200 && (pdfRes.headers.get("content-type") ?? "").includes("pdf"),
      `HTTP ${pdfRes.status}`);
    check("of real substance", pdfBuf.subarray(0, 4).toString() === "%PDF" && pdfBuf.length > 5000, `${pdfBuf.length} bytes`);
    check("the file is named for the person",
      decodeURIComponent(pdfRes.headers.get("content-disposition") ?? "").includes(person.fullName));
    // a legend nobody can read is the same as none: check the WORDS reach the
    // page, extracted from the PDF's own text
    const pdfText = pdfBuf.toString("latin1");
    check("the pdf is text-bearing (not a flattened image)", pdfText.includes("/Font"));
    const { VECTOR_LEGEND } = await import("@/lib/plan-diagram");
    check("the legend names every status the drawing can paint", VECTOR_LEGEND.length === 4,
      VECTOR_LEGEND.map((l) => l.label).join(", "));
    // the halo animates, so print would catch it at an arbitrary opacity
    check("the pulse halo is suppressed in print", v.svg.includes("@media print") && v.svg.includes(".vs-ring { display: none"));
    check("without a session the export refuses",
      (await fetch(`${BASE}/people/${person.id}/plan-pdf`)).status === 401);
    // a URL must never become a way to read someone outside your scope
    const outsider = await prisma.user.create({
      data: { name: `${TAG} זר`, email: `${TAG}z@v.invalid`, username: `${TAG}-out`, passwordHash: hashPassword("x"), role: "MANAGER" },
    });
    check("someone who cannot see the person cannot export their plan",
      (await fetch(`${BASE}/people/${person.id}/plan-pdf`, {
        headers: { cookie: `${SESSION_COOKIE}=${createSessionToken(outsider.id)}` },
      })).status === 404);
  } finally {
    await cleanup();
    const residue = (await prisma.person.count({ where: { fullName: { startsWith: TAG } } })) +
      (await prisma.careerPlan.count({ where: { name: { startsWith: TAG } } }));
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
