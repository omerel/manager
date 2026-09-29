/**
 * Verification for guest-self-view — a tracked person admitted to READ their
 * own record, and nothing else.
 *
 * The centre of this suite is CONTAINMENT: that a guest cookie opens exactly
 * one page and one export, and that every other page in the system treats its
 * holder as a stranger. Everything else — the admission rules, the uniform
 * refusal — exists to keep that boundary meaningful.
 *
 * Needs the dev server on :4321.
 *
 *   npx tsx scripts/verify-guest-access.ts
 */
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { createSessionToken, SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { GUEST_COOKIE, GUEST_TTL_MS, createGuestToken, verifyGuestToken } from "@/lib/guest-token";
import { resolveGuest, GUEST_REFUSAL } from "@/lib/guest-session";
import { IDENTITY_LABELS } from "@/lib/identity-keys";

const BASE = process.env.BASE_URL ?? "http://localhost:4321";
const TAG = "guestverify";
const TZ = "918273645";
const OTHER_TZ = "918273600";
const PN = "7654321";
const BIRTH = new Date(Date.UTC(1998, 4, 17)); // 17/05/1998

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

/** Follow nothing: we want to see the redirect itself. */
const get = (path: string, cookie?: string) =>
  fetch(BASE + path, { headers: cookie ? { cookie } : {}, redirect: "manual" });

async function main() {
  await cleanup();

  const tzDef = await prisma.personFieldDef.findFirst({ where: { label: IDENTITY_LABELS[0] }, select: { id: true } });
  const pnDef = await prisma.personFieldDef.findFirst({ where: { label: IDENTITY_LABELS[1] }, select: { id: true } });
  if (!tzDef) {
    console.log(`\nFAILED — the «${IDENTITY_LABELS[0]}» card field is not defined; guest entry cannot work at all.`);
    process.exitCode = 1;
    await prisma.$disconnect();
    return;
  }

  const center = await prisma.orgNode.create({ data: { name: `${TAG} מרכז`, kind: "CENTER" } });
  const domain = await prisma.orgNode.create({ data: { name: `${TAG} תחום`, kind: "DOMAIN", parentId: center.id } });
  const section = await prisma.orgNode.create({ data: { name: `${TAG} מדור`, kind: "SECTION", parentId: domain.id } });
  const team = await prisma.orgNode.create({ data: { name: `${TAG} צוות`, kind: "TEAM", parentId: section.id } });
  const admin = await prisma.user.create({
    data: { name: `${TAG} אדמין`, email: `${TAG}@v.invalid`, username: `${TAG}-adm`, passwordHash: hashPassword("x"), role: "ADMIN" },
  });

  const plan = await prisma.careerPlan.create({
    data: {
      name: `${TAG} מסלול`, isTemplate: false,
      pointEvents: { create: [{ label: `${TAG} אירוע`, offsetMonths: 6 }] },
      recurringEvents: {
        create: [{ label: `${TAG} ראיון`, intervalMonths: 6, startOffsetMonths: 6, stopMode: "UNTIL_OFFSET", stopOffsetMonths: 36, display: "CARD", withScore: true }],
      },
    },
    include: { recurringEvents: true },
  });

  const mkPerson = async (last: string, opts: { tz?: string; pn?: string; birth?: Date | null; planId?: string | null }) => {
    const p = await prisma.person.create({
      data: {
        firstName: TAG, lastName: last, fullName: `${TAG} ${last}`,
        recruitmentDate: new Date("2020-01-01"), placementDate: new Date("2020-01-01"),
        birthDate: opts.birth === undefined ? BIRTH : opts.birth,
        teamId: team.id, assignedPlanId: opts.planId ?? null,
      },
    });
    if (opts.tz) await prisma.personFieldValue.create({ data: { personId: p.id, fieldDefId: tzDef.id, value: opts.tz } });
    if (opts.pn && pnDef) await prisma.personFieldValue.create({ data: { personId: p.id, fieldDefId: pnDef.id, value: opts.pn } });
    return p;
  };

  // the admissible one, and the neighbours that must all be refused
  const guest = await mkPerson("אורח", { tz: TZ, pn: PN, planId: plan.id });
  await prisma.planAssignment.create({
    data: { personId: guest.id, planId: plan.id, templateName: plan.name, assignedAt: new Date("2020-01-01"), waiverOffsetMonths: 0 },
  });
  // an interview summary with a 1-5 score — the guest is meant to see this
  await prisma.evalEntry.create({
    data: {
      personId: guest.id, kind: "INTERVIEW", title: `${TAG} סיכום ראיון`,
      content: `${TAG} תוכן ההערכה`, score: 4,
      eventDate: new Date("2021-01-01"),
      recurringEventId: plan.recurringEvents[0].id, occurrenceOffset: 6,
    },
  });
  const noPlan = await mkPerson("ללא-תכנית", { tz: OTHER_TZ, planId: null });
  const noBirth = await mkPerson("ללא-לידה", { tz: "918273611", birth: null, planId: plan.id });
  const other = await mkPerson("אחר", { tz: "918273622", planId: plan.id });

  try {
    console.log("=== the admission rule ===");
    check("the right pair is admitted", (await resolveGuest(BIRTH, TZ))?.id === guest.id);
    check("a person with no career plan is not", (await resolveGuest(BIRTH, OTHER_TZ)) === null);
    check("a wrong date of birth is not", (await resolveGuest(new Date(Date.UTC(1998, 4, 18)), TZ)) === null);
    check("an unknown identity is not", (await resolveGuest(BIRTH, "111111111")) === null);
    check("a person with no recorded date of birth is not", (await resolveGuest(BIRTH, "918273611")) === null);
    check("a missing date of birth on the form is not", (await resolveGuest(null, TZ)) === null);
    check("an empty identity is not", (await resolveGuest(BIRTH, "   ")) === null);
    check("the date is compared as a DAY, not an instant",
      (await resolveGuest(new Date(Date.UTC(1998, 4, 17, 13, 45)), TZ))?.id === guest.id);

    console.log("\n=== the personal number is not a key ===");
    check("the personal-number field exists and is populated on our fixture", !!pnDef);
    check("a correct personal number is refused as an identity", (await resolveGuest(BIRTH, PN)) === null);

    console.log("\n=== an ambiguous identity is refused, never resolved ===");
    const twin = await mkPerson("תאום", { tz: TZ, planId: plan.id });
    check("two people holding one identity → nobody is admitted", (await resolveGuest(BIRTH, TZ)) === null);
    await prisma.person.delete({ where: { id: twin.id } });
    check("...and the admission returns once the clash is gone", (await resolveGuest(BIRTH, TZ))?.id === guest.id);

    console.log("\n=== every refusal is the same refusal ===");
    // resolveGuest returns a person or null and NEVER a reason, so there is
    // nothing for a caller to leak. That is the property under test.
    const refusals = await Promise.all([
      resolveGuest(BIRTH, "111111111"),
      resolveGuest(new Date(Date.UTC(1998, 4, 18)), TZ),
      resolveGuest(BIRTH, OTHER_TZ),
      resolveGuest(BIRTH, "918273611"),
      resolveGuest(null, TZ),
    ]);
    check("all five failure paths return exactly null — no reason to leak",
      refusals.every((r) => r === null), JSON.stringify(refusals));
    check("the refusal names no person", !GUEST_REFUSAL.includes(TAG) && !/\d/.test(GUEST_REFUSAL), GUEST_REFUSAL);
    check("...and hints at neither of the two fields",
      !GUEST_REFUSAL.includes("זהות") && !GUEST_REFUSAL.includes("לידה"), GUEST_REFUSAL);

    console.log("\n=== the two session kinds do not cross ===");
    const guestTok = createGuestToken(guest.id);
    const userTok = createSessionToken(admin.id);
    check("a guest token does not verify as a user session", verifySessionToken(guestTok) === null);
    check("a user token does not verify as a guest session", verifyGuestToken(userTok) === null);
    check("a guest token verifies as itself", verifyGuestToken(guestTok) === guest.id);
    check("an expired guest token is refused",
      verifyGuestToken(createGuestToken(guest.id, Date.now() - GUEST_TTL_MS - 1000)) === null);
    check("a tampered guest token is refused", verifyGuestToken(guestTok.slice(0, -2) + "00") === null);
    check("a guest token with a swapped person id is refused",
      verifyGuestToken(guestTok.replace(guest.id, other.id)) === null);

    console.log("\n=== containment: the guest cookie opens two doors, no more ===");
    const gc = `${GUEST_COOKIE}=${guestTok}`;
    const walled = ["/", "/people", `/people/${other.id}`, "/hierarchy", "/queries", "/system", "/plans", "/account"];
    for (const path of walled) {
      const r = await get(path, gc);
      const shut = r.status === 307 || r.status === 302 || r.status === 401 || r.status === 404;
      check(`${path} is shut to a guest`, shut, `HTTP ${r.status}${r.headers.get("location") ? " → " + r.headers.get("location") : ""}`);
    }
    const otherPdf = await get(`/people/${other.id}/plan-pdf`, gc);
    check("another person's plan export is shut to a guest", otherPdf.status === 401, `HTTP ${otherPdf.status}`);
    const ownPdfAsUserRoute = await get(`/people/${guest.id}/plan-pdf`, gc);
    check("even their OWN record's user-route export is shut", ownPdfAsUserRoute.status === 401, `HTTP ${ownPdfAsUserRoute.status}`);

    console.log("\n=== the two doors that do open ===");
    const me = await get("/me", gc);
    check("/me opens", me.status === 200, `HTTP ${me.status}`);
    const html = (await (await fetch(BASE + "/me", { headers: { cookie: gc } })).text()).replaceAll("<!-- -->", "");
    check("it shows their name", html.includes(`${TAG} אורח`));
    check("it draws the career plan", html.includes("תכנית קריירה") && html.includes("<svg"));
    check("it lists the plan's items", html.includes(`${TAG} אירוע`));
    check("it shows the interview summary written about them", html.includes(`${TAG} תוכן ההערכה`));
    check("...including the 1–5 assessment", /[4]\s*\/\s*5|דירוג/.test(html) || html.includes("★"), "score rendered");
    check("the header names the guest and offers a way out",
      html.includes(`${TAG} אורח`) && html.includes("יציאה"));
    check("the header offers no navigation into the system",
      !html.includes('href="/people"') && !html.includes('href="/hierarchy"'));
    // The header carries ONE form — signing out, which the spec requires. What
    // must not exist is a form in the BODY: that would be a control that
    // changes the person's data. Asserting "no form at all" would have been
    // asserting that the guest cannot leave.
    const body = html.replace(/<header[\s\S]*?<\/header>/g, "");
    check("no form in the page body — no control that changes anything",
      !body.includes("<form"), `${(body.match(/<form/g) ?? []).length} forms below the header`);
    check("the ONLY form on the page is the sign-out, in the header",
      (html.match(/<form/g) ?? []).length === 1, `${(html.match(/<form/g) ?? []).length} total`);
    check("...and no upload control reached the page", !html.includes('type="file"'));

    const pdf = await fetch(BASE + "/me/plan-pdf", { headers: { cookie: gc } });
    const buf = Buffer.from(await pdf.arrayBuffer());
    check("/me/plan-pdf returns their plan", pdf.status === 200 && buf.subarray(0, 4).toString() === "%PDF", `HTTP ${pdf.status}, ${buf.length} bytes`);
    check("/me/plan-pdf without a cookie is refused", (await get("/me/plan-pdf")).status === 401);
    check("/me without a cookie redirects to login", [307, 302].includes((await get("/me")).status));

    console.log("\n=== removing the plan closes the door ===");
    await prisma.person.update({ where: { id: guest.id }, data: { assignedPlanId: null } });
    // the cookie is still valid and unexpired — what closed is the plan, and
    // `getGuestPersonOrNull` re-asks on every read rather than trusting it
    check("/me now redirects, on the SAME still-valid cookie", [307, 302].includes((await get("/me", gc)).status));
    check("the export closes too", (await get("/me/plan-pdf", gc)).status === 401);
    check("and they cannot get back in", (await resolveGuest(BIRTH, TZ)) === null);
    await prisma.person.update({ where: { id: guest.id }, data: { assignedPlanId: plan.id } });
    check("restoring the plan lets them in again", (await resolveGuest(BIRTH, TZ))?.id === guest.id);

    console.log("\n=== the user path is untouched ===");
    const uc = `${SESSION_COOKIE}=${userTok}`;
    check("an admin still reaches the dashboard", (await get("/", uc)).status === 200);
    check("an admin still reaches a person's card", (await get(`/people/${other.id}`, uc)).status === 200);
    check("an admin still reaches the user plan export", (await get(`/people/${guest.id}/plan-pdf`, uc)).status === 200);
    check("a user session does NOT open /me", [307, 302].includes((await get("/me", uc)).status));
    const loginHtml = await (await fetch(BASE + "/login")).text();
    check("the login page offers both ways in",
      loginHtml.includes("כניסת משתמש") && loginHtml.includes("כניסת אורח"));
    check("the guest form asks for a date of birth and an identity",
      loginHtml.includes('name="birthDate"') && loginHtml.includes('name="tz"'));
  } finally {
    await cleanup();
    const residue =
      (await prisma.person.count({ where: { fullName: { startsWith: TAG } } })) +
      (await prisma.careerPlan.count({ where: { name: { startsWith: TAG } } })) +
      (await prisma.orgNode.count({ where: { name: { startsWith: TAG } } })) +
      (await prisma.user.count({ where: { username: { startsWith: TAG } } }));
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
