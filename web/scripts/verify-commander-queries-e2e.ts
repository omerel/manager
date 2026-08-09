/**
 * Verification for commander-queries — the actions, through the real forms.
 *
 * The rules layer is covered by verify-commander-queries.ts, which calls the
 * predicates directly. It cannot prove that the actions CALL them: every action
 * here opens with a session lookup, and in a bare script that lookup throws
 * before any guard runs — so a check that merely asserts "it was refused" would
 * go green against code with no guard in it at all.
 *
 * This half signs in as real commanders and works the page. Three different
 * users are needed, because the audience rule is the point: what a domain
 * commander may do is exactly what a section commander may not.
 *
 * Requires the dev server (BASE_URL, default http://localhost:4321).
 *
 *   npx tsx scripts/verify-commander-queries-e2e.ts
 */
import { chromium, type Browser, type Page } from "playwright";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { formatIsraeliDate, todayMarker } from "@/lib/dates";

const BASE = process.env.BASE_URL ?? "http://localhost:4321";
const TAG = "cqe2e";
const MAIL = `@${TAG}.invalid`;
const PASSWORD = "verify-queries-1234";

let failures = 0;
let checks = 0;
function check(label: string, ok: boolean, detail = "") {
  checks++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function cleanup() {
  await prisma.person.deleteMany({ where: { fullName: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: MAIL } } });
  await prisma.orgNode.deleteMany({ where: { name: { startsWith: TAG } } });
}

/** All page text, including the dev error overlay — which lives behind a shadow root. */
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

async function signIn(browser: Browser, username: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="identifier"]', username);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"], form button');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
  return page;
}

const inDays = (n: number) => formatIsraeliDate(new Date(todayMarker().getTime() + n * 86400_000));

async function main() {
  await cleanup();

  const center = await prisma.orgNode.create({ data: { name: `${TAG} מרכז`, kind: "CENTER" } });
  const domain = await prisma.orgNode.create({ data: { name: `${TAG} תחום`, kind: "DOMAIN", parentId: center.id } });
  const sec1 = await prisma.orgNode.create({ data: { name: `${TAG} מדור א`, kind: "SECTION", parentId: domain.id } });
  const sec2 = await prisma.orgNode.create({ data: { name: `${TAG} מדור ב`, kind: "SECTION", parentId: domain.id } });
  const team = await prisma.orgNode.create({ data: { name: `${TAG} צוות`, kind: "TEAM", parentId: sec1.id } });

  const mk = async (handle: string, node: string | null, role: "ADMIN" | "MANAGER" | "HR" = "MANAGER") =>
    prisma.user.create({
      data: {
        name: `${TAG}-${handle}`, email: `${handle}${MAIL}`, username: `${TAG}-${handle}`,
        passwordHash: hashPassword(PASSWORD), role, commandsNodeId: node,
      },
    });

  await mk("dom", domain.id); // sends to the two sections
  await mk("sec1", sec1.id); // answers
  // sec2 deliberately has NO commander — the row nobody can fill
  await mk("team", team.id); // receives only
  await mk("admin", null, "ADMIN"); // commands nothing → no page at all
  await mk("admin2", null, "ADMIN"); // performs the deletion; an admin cannot delete themselves

  const browser = await chromium.launch();
  try {
    console.log("\n=== the page belongs to the chain of command ===");
    const admin = await signIn(browser, `${TAG}-admin`);
    await admin.goto(`${BASE}/queries`);
    const adminText = await fullText(admin);
    check("an Admin who commands nothing gets no page", adminText.includes("מיועד למפקדי מסגרות"),
      adminText.includes("מיועד למפקדי מסגרות") ? "refused" : "ADMIN GOT THE PAGE");
    check("and no create form", (await admin.locator('textarea[name="body"]').count()) === 0);

    const teamPage = await signIn(browser, `${TAG}-team`);
    await teamPage.goto(`${BASE}/queries`);
    check("a team commander gets no create form — nobody below them",
      (await teamPage.locator('button:text("שלח שאילתא")').count()) === 0);
    check("but does get the received section, under its new name", (await fullText(teamPage)).includes("שאילתות עבורי"));

    console.log("\n=== sending ===");
    const dom = await signIn(browser, `${TAG}-dom`);
    await dom.goto(`${BASE}/queries`);
    check("a domain commander gets the create form", (await dom.locator('button:text("שלח שאילתא")').count()) === 1);
    check("and the for-me panel exists for them too — anyone may be addressed now",
      (await fullText(dom)).includes("שאילתות עבורי"));
    check("the recipients arrive pre-checked, the whole level below",
      (await dom.locator('form:has(button:text("שלח שאילתא")) input[type="checkbox"]:checked').count()) === 2,
      `${await dom.locator('form:has(button:text("שלח שאילתא")) input[type="checkbox"]:checked').count()} of 2`);
    check("the uncommanded section is flagged in the checklist", (await fullText(dom)).includes("אין מפקד"));

    await dom.fill('input[name="title"]', `${TAG} מצב הסמכות`);
    await dom.fill('textarea[name="body"]', "נא לדווח על מצב ההסמכות ברבעון.");
    await dom.locator('form:has(button:text("שלח שאילתא")) input[name="dueDate"]').fill(inDays(7));
    await dom.locator('button:text("שלח שאילתא")').click();
    await dom.waitForTimeout(2500);

    const q = await prisma.query.findFirst({ where: { title: `${TAG} מצב הסמכות` }, include: { targets: true } });
    check("the query was created", !!q);
    check("an UNTOUCHED form reaches exactly the audience the automatic rule reached — one row per section",
      q?.targets.length === 2 && [sec1.id, sec2.id].every((id) => q!.targets.some((t) => t.nodeId === id)),
      `${q?.targets.length} targets`);
    check("and not for the team two levels down", !q?.targets.some((t) => t.nodeId === team.id));

    const listed = await fullText(dom);
    check("the sender's list shows the framework nobody commands", listed.includes("אין מפקד למסגרת"),
      listed.includes("אין מפקד למסגרת") ? "flagged" : "NOT FLAGGED");
    check("and reports 0/2 responded", listed.includes("0/2"), listed.includes("0/2") ? "0/2" : "count missing");

    console.log("\n=== answering ===");
    const sec = await signIn(browser, `${TAG}-sec1`);
    await sec.goto(`${BASE}/queries`);
    const secText = await fullText(sec);
    check("the addressed commander sees the query", secText.includes(`${TAG} מצב הסמכות`));
    check("marked as awaiting them", secText.includes("ממתין לתשובתך"));
    check("the header carries a count of 1", /שאילתות\s*1/.test(secText),
      /שאילתות\s*1/.test(secText) ? "badge shows 1" : "BADGE NOT FOUND");

    await sec.locator('form:has(button:text("שלח תשובה")) textarea[name="answer"]').fill("שמונה מתוך עשרה הוסמכו.");
    await sec.locator('button:text("שלח תשובה")').click();
    await sec.waitForTimeout(2000);
    const answered = await prisma.queryTarget.findFirstOrThrow({ where: { queryId: q!.id, nodeId: sec1.id } });
    check("the answer is stored", answered.answer === "שמונה מתוך עשרה הוסמכו.");
    check("credited to whoever wrote it", !!answered.answeredById);
    check("with a first-answer timestamp", !!answered.answeredAt);
    check("and NO revision date — nothing was revised", answered.updatedAt === null);

    await sec.reload();
    await sec.locator('form:has(button:text("עדכן תשובה")) textarea[name="answer"]').fill("תשע מתוך עשרה הוסמכו.");
    await sec.locator('button:text("עדכן תשובה")').click();
    await sec.waitForTimeout(2000);
    const revised = await prisma.queryTarget.findFirstOrThrow({ where: { queryId: q!.id, nodeId: sec1.id } });
    check("a revision replaces the answer", revised.answer === "תשע מתוך עשרה הוסמכו.");
    check("keeps the original answered-at", revised.answeredAt?.getTime() === answered.answeredAt?.getTime());
    check("and now carries a revision date", !!revised.updatedAt);

    console.log("\n=== the audience is closed ===");
    await sec.goto(`${BASE}/queries`);
    const secSees = await fullText(sec);
    check("a target does not see a sibling's answer", !secSees.includes("אין מפקד למסגרת"),
      !secSees.includes("אין מפקד למסגרת") ? "sender-side rows absent" : "SENDER-SIDE ROWS LEAKED");
    await teamPage.goto(`${BASE}/queries`);
    check("a framework below a target sees nothing of it", !(await fullText(teamPage)).includes(`${TAG} מצב הסמכות`));
    await admin.goto(`${BASE}/queries`);
    check("and the Admin still sees nothing", !(await fullText(admin)).includes(`${TAG} מצב הסמכות`));

    console.log("\n=== content freezes, the date does not ===");
    await dom.goto(`${BASE}/queries`);
    const domSees = await fullText(dom);
    check("the sender reads the answer", domSees.includes("תשע מתוך עשרה הוסמכו."));
    check("and sees it was revised", domSees.includes("עודכן לאחרונה"));
    check("content editing is gone now that an answer exists", domSees.includes("התוכן נעול"),
      domSees.includes("התוכן נעול") ? "frozen" : "STILL EDITABLE");
    check("and the edit form is not rendered", (await dom.locator('summary:text("ערוך תוכן")').count()) === 0);

    // A past date is refused as an ordinary validation message, not turned into
    // a confirmation ritual: that is what made a typo look like a crash.
    await dom.locator('form:has(button:text("עדכן")) input[name="dueDate"]').fill(inDays(-1));
    await dom.locator('button:text("עדכן")').click();
    await dom.waitForTimeout(2000);
    const pastMsg = await fullText(dom);
    check("a past deadline is refused", pastMsg.includes("כבר עבר"), pastMsg.includes("כבר עבר") ? "refused" : "IT WENT THROUGH");
    check("and the message points at the close button instead", pastMsg.includes("סגור שאילתא"),
      pastMsg.includes("סגור שאילתא") ? "redirected to the right control" : "NO GUIDANCE");
    const unchanged = await prisma.query.findUniqueOrThrow({ where: { id: q!.id } });
    check("the date did not move", unchanged.dueDate.getTime() === q!.dueDate.getTime());
    check("and nothing was closed as a side effect", unchanged.closedAt === null);

    // the calendar itself will not offer a past day
    await dom.goto(`${BASE}/queries`);
    const min = await dom.locator('form:has(button:text("שלח שאילתא")) input[type="date"]').getAttribute("min");
    check("the create form's calendar has today as its floor", min === new Date(todayMarker()).toISOString().slice(0, 10),
      String(min));

    console.log("\n=== closing early ===");
    dom.on("dialog", (d) => d.accept()); // the close button confirms first
    await dom.locator('button:text("סגור שאילתא")').first().click();
    await dom.waitForTimeout(2000);
    const closed = await prisma.query.findUniqueOrThrow({ where: { id: q!.id } });
    check("the query is closed", !!closed.closedAt);
    check("and the STATED DEADLINE is untouched — not rewritten into the past",
      closed.dueDate.getTime() === q!.dueDate.getTime(),
      `still ${closed.dueDate.toISOString().slice(0, 10)}`);
    check("the deadline is still in the future, and the query is shut anyway",
      closed.dueDate.getTime() > todayMarker().getTime() && !!closed.closedAt);

    console.log("\n=== closed means closed, and reopening restores it ===");
    await sec.goto(`${BASE}/queries`);
    // the closed query folds now — expand every fold so its text is readable
    for (const d of await sec.locator("details").all()) await d.evaluate((el) => ((el as HTMLDetailsElement).open = true));
    const secClosed = await fullText(sec);
    const stillEditable = await sec.locator('textarea[name="answer"]').count();
    check("the target can no longer edit", stillEditable === 0, stillEditable === 0 ? "form gone" : "FORM STILL PRESENT");
    check("and is told the sender closed it, not that a date passed",
      secClosed.includes("השאילתא נסגרה"), secClosed.includes("השאילתא נסגרה") ? "correct reason shown" : "WRONG REASON");
    check("the header count drops to nothing", !/שאילתות\s*[1-9]/.test(secClosed),
      !/שאילתות\s*[1-9]/.test(secClosed) ? "badge clear" : "BADGE STILL COUNTING");

    await dom.goto(`${BASE}/queries`);
    for (const d of await dom.locator("details").all()) await d.evaluate((el) => ((el as HTMLDetailsElement).open = true));
    await dom.locator('button:text("פתח מחדש")').first().click();
    await dom.waitForTimeout(2000);
    check("reopening clears the early close",
      (await prisma.query.findUniqueOrThrow({ where: { id: q!.id } })).closedAt === null);
    await sec.goto(`${BASE}/queries`);
    const reopened = await sec.locator('textarea[name="answer"]').count();
    check("and the target may answer again", reopened === 1, reopened === 1 ? "form is back" : "FORM STILL GONE");
    check("with the answer they had given still there",
      (await sec.locator('textarea[name="answer"]').inputValue()) === "תשע מתוך עשרה הוסמכו.");

    console.log("\n=== reminders ===");
    await dom.goto(`${BASE}/queries`);
    const remindButtons = await dom.locator('button:text("שלח תזכורת")').count();
    check("no reminder button for a framework with no commander — there is nobody to remind",
      remindButtons === 0, `${remindButtons} buttons (sec2 uncommanded, sec1 answered)`);

    // give sec2 a commander, and the reminder becomes available
    await mk("sec2", sec2.id);
    await dom.goto(`${BASE}/queries`);
    check("appointing a commander makes the row remindable",
      (await dom.locator('button:text("שלח תזכורת")').count()) === 1);
    await dom.locator('button:text("שלח תזכורת")').click();
    await dom.waitForTimeout(2500);
    const reminded = await prisma.queryTarget.findFirstOrThrow({ where: { queryId: q!.id, nodeId: sec2.id } });
    check("the reminder is recorded", !!reminded.remindedAt);
    check("and the mail outcome is kept, not lost after the response", reminded.mailOk !== null,
      `mailOk=${reminded.mailOk}`);

    console.log("\n=== a framework with nothing below it ===");
    const teamCmd = await prisma.user.findFirstOrThrow({ where: { email: `team${MAIL}` } });
    check("the team commander still has no send form", teamCmd.commandsNodeId === team.id);
    await teamPage.goto(`${BASE}/queries`);
    check("confirmed in the page", (await teamPage.locator('button:text("שלח שאילתא")').count()) === 0);
    console.log("\n=== choosing recipients ===");
    // uncheck ONE default recipient and prove that framework got nothing
    await dom.goto(`${BASE}/queries`);
    const form = dom.locator('form:has(button:text("שלח שאילתא"))');
    await form.locator('input[name="title"]').fill(`${TAG} ממוקדת`);
    await form.locator('textarea[name="body"]').fill("רק למדור אחד.");
    await form.locator('input[name="dueDate"]').fill(inDays(6));
    // uncheck the box whose label names sec2
    await form.locator(`label:has-text("${TAG} מדור ב") input[type="checkbox"]`).uncheck();
    await form.locator('button:text("שלח שאילתא")').click();
    await dom.waitForTimeout(2500);
    const narrow = await prisma.query.findFirstOrThrow({ where: { title: `${TAG} ממוקדת` }, include: { targets: true } });
    check("only the checked framework is a target", narrow.targets.length === 1 && narrow.targets[0].nodeId === sec1.id,
      `${narrow.targets.length} targets`);
    check("the unchecked one got NOTHING — no row, no trace",
      (await prisma.queryTarget.count({ where: { queryId: narrow.id, nodeId: sec2.id } })) === 0);

    // unchecking EVERYTHING is refused, not silently defaulted
    await dom.goto(`${BASE}/queries`);
    const form2 = dom.locator('form:has(button:text("שלח שאילתא"))');
    await form2.locator('input[name="title"]').fill(`${TAG} ריקה`);
    await form2.locator('textarea[name="body"]').fill("בלי נמענים.");
    await form2.locator('input[name="dueDate"]').fill(inDays(6));
    for (const box of await form2.locator('input[type="checkbox"]').all()) await box.uncheck();
    await form2.locator('button:text("שלח שאילתא")').click();
    await dom.waitForTimeout(2000);
    check("no recipients → refused", (await prisma.query.count({ where: { title: `${TAG} ריקה` } })) === 0);
    check("with a message asking for one", (await fullText(dom)).includes("נמען אחד לפחות"));

    console.log("\n=== ‎@‎ reaches across the tree ===");
    // the TEAM commander (below sec1, another branch relative to sec2) becomes addressable
    await dom.goto(`${BASE}/queries`);
    const form3 = dom.locator('form:has(button:text("שלח שאילתא"))');
    await form3.locator('input[name="title"]').fill(`${TAG} חוצת-ענף`);
    await form3.locator('textarea[name="body"]').fill("גם לצוות, שאינו בדרגה שמתחתי.");
    await form3.locator('input[name="dueDate"]').fill(inDays(6));
    await form3.locator('input[placeholder*="הוסף מפקד"]').fill(`${TAG} צוות`);
    await dom.waitForTimeout(600);
    await dom.locator(`button:has-text("${TAG} צוות")`).last().click();
    await dom.waitForTimeout(400);
    await form3.locator('button:text("שלח שאילתא")').click();
    await dom.waitForTimeout(2500);
    const cross = await prisma.query.findFirstOrThrow({ where: { title: `${TAG} חוצת-ענף` }, include: { targets: true } });
    check("the ‎@‎-added framework is a target alongside the defaults",
      cross.targets.some((t) => t.nodeId === team.id) && cross.targets.length === 3, `${cross.targets.length} targets`);
    await teamPage.goto(`${BASE}/queries`);
    const teamSees2 = await fullText(teamPage);
    check("its commander sees the query in שאילתות עבורי — two levels below the sender",
      teamSees2.includes(`${TAG} חוצת-ענף`));
    await teamPage.locator('form:has(button:text("שלח תשובה")) textarea[name="answer"]').first().fill("תשובת הצוות.");
    await teamPage.locator('button:text("שלח תשובה")').first().click();
    await teamPage.waitForTimeout(2000);
    const teamRow = await prisma.queryTarget.findFirstOrThrow({ where: { queryId: cross.id, nodeId: team.id } });
    check("they can answer it", teamRow.answer === "תשובת הצוות.");
    await dom.goto(`${BASE}/queries`);
    check("and the sender reads the answer and the tally counts it",
      (await fullText(dom)).includes("תשובת הצוות."));

    console.log("\n=== the two panels, the fold, and the side chooser ===");
    // close one query so the fold has something real to show — and note the
    // marker: the edit-content disclosure is ALSO a <details>, so the folded
    // queries carry data-folded-query and the checks select on that, not on
    // the tag
    await dom.goto(`${BASE}/queries`);
    await dom.locator(`div.rounded-xl:has-text("${TAG} ממוקדת") button:text("סגור שאילתא")`).first().click();
    await dom.waitForTimeout(2000);
    await dom.goto(`${BASE}/queries`);
    const layoutText = await fullText(dom);
    check("both panels are present", layoutText.includes("השאילתות שלי") && layoutText.includes("שאילתות עבורי"));
    const folded = await dom.locator("details[data-folded-query]").count();
    check("the closed query renders folded", folded === 1, `${folded} folded`);
    check("with the green check on its summary line",
      (await dom.locator('details[data-folded-query] summary svg').count()) >= 1);
    const kinds = await dom
      .locator('section:has(h2:text("השאילתות שלי")) > div.rounded-xl, section:has(h2:text("השאילתות שלי")) > details[data-folded-query]')
      .evaluateAll((els) => els.map((el) => el.tagName));
    const firstDetails = kinds.indexOf("DETAILS");
    check("open queries come before folded ones", firstDetails === kinds.length - 1 && kinds.lastIndexOf("DIV") < firstDetails,
      kinds.join(","));
    const firstFold = dom.locator("details[data-folded-query]").first();
    await firstFold.locator("> summary").click();
    await dom.waitForTimeout(300);
    check("expanding a folded query reveals its actions",
      (await firstFold.locator('button:text("פתח מחדש"), button:text("סגור שאילתא"), button:text("מחק שאילתא")').count()) > 0,
      "reopen/delete reachable inside the fold");

    // the side chooser: assert on the section headings, not on page text —
    // the chooser's own option labels contain both panel names
    const mineHeading = 'section h2:text-is("השאילתות שלי")';
    const formeHeading = 'section h2:text-is("שאילתות עבורי")';
    await dom.goto(`${BASE}/queries?side=mine`);
    check("side=mine hides the for-me panel",
      (await dom.locator(mineHeading).count()) === 1 && (await dom.locator(formeHeading).count()) === 0);
    await dom.goto(`${BASE}/queries?side=forme`);
    check("side=forme hides mine",
      (await dom.locator(formeHeading).count()) === 1 && (await dom.locator(mineHeading).count()) === 0);
    await dom.reload();
    await dom.waitForTimeout(1000);
    check("the side choice survives a reload", (await dom.locator(mineHeading).count()) === 0);
    // reopen the query we closed, so later sections meet the state they expect
    for (const d of await dom.locator("details[data-folded-query]").all()) await d.evaluate((el) => ((el as HTMLDetailsElement).open = true));
    await dom.goto(`${BASE}/queries`);
    for (const d of await dom.locator("details[data-folded-query]").all()) await d.evaluate((el) => ((el as HTMLDetailsElement).open = true));
    await dom.locator('button:text("פתח מחדש")').first().click();
    await dom.waitForTimeout(1500);

    console.log("\n=== tagging a person ===");
    // a person inside sec1, visible to both the domain and the section commander
    const person = await prisma.person.create({
      data: {
        firstName: TAG, lastName: "נבדק", fullName: `${TAG} נבדק`,
        recruitmentDate: new Date("2020-01-01"), placementDate: new Date("2020-01-01"), teamId: team.id,
      },
    });
    await prisma.accessGrant.create({ data: { userId: (await prisma.user.findFirstOrThrow({ where: { email: `dom${MAIL}` } })).id, nodeId: domain.id, level: "VIEW" } });
    await prisma.accessGrant.create({ data: { userId: (await prisma.user.findFirstOrThrow({ where: { email: `sec1${MAIL}` } })).id, nodeId: sec1.id, level: "VIEW" } });

    await dom.goto(`${BASE}/queries`);
    await dom.locator('form:has(button:text("שלח שאילתא")) input[name="title"]').fill(`${TAG} תיוג`);
    const box = dom.locator('form:has(button:text("שלח שאילתא")) textarea[name="body"]');
    await box.fill("נא לעדכן על ");
    await box.press("@");
    await box.type(TAG);
    await dom.waitForTimeout(700);
    const options = await dom.locator(`button:has-text("${TAG} נבדק")`).count();
    check("typing @ opens a picker with the person", options >= 1, `${options} options`);

    await dom.locator(`button:has-text("${TAG} נבדק")`).first().click();
    await dom.waitForTimeout(400);
    const typed = await box.inputValue();
    check("choosing inserts a tag carrying the id", typed.includes(`](${person.id})`), typed.slice(0, 80));

    await dom.locator('form:has(button:text("שלח שאילתא")) input[name="dueDate"]').fill(inDays(5));
    await dom.locator('button:text("שלח שאילתא")').click();
    await dom.waitForTimeout(2500);
    const tagged = await prisma.query.findFirstOrThrow({ where: { title: `${TAG} תיוג` } });
    check("the tag is stored with the query", tagged.body.includes(`](${person.id})`));

    await dom.goto(`${BASE}/queries`);
    const link = dom.locator(`a[href="/people/${person.id}"]`).first();
    check("the sender sees it rendered as a link", (await link.count()) === 1);
    check("labelled with the person's name", (await link.innerText()).includes(`${TAG} נבדק`));
    check("opening in a new tab, so the query is not lost", (await link.getAttribute("target")) === "_blank");
    check("and NOT showing the raw markup", !(await fullText(dom)).includes(`](${person.id})`));

    // the link actually goes somewhere
    const opened = await dom.context().newPage();
    await opened.goto(`${BASE}/people/${person.id}`);
    check("the link leads to that person's page", (await opened.locator("body").innerText()).includes(`${TAG} נבדק`));
    await opened.close();

    // a reader who cannot see the person gets the name without a link
    await teamPage.goto(`${BASE}/queries`);
    const teamSees = await fullText(teamPage);
    check("a reader without access sees the name as plain text",
      !teamSees.includes(`](${person.id})`) && (await teamPage.locator(`a[href="/people/${person.id}"]`).count()) === 0,
      "no dead link offered");

    // renaming shows the CURRENT name, not the one stored in the tag
    await prisma.person.update({ where: { id: person.id }, data: { lastName: "שונה", fullName: `${TAG} שונה` } });
    await dom.goto(`${BASE}/queries`);
    const renamed = await fullText(dom);
    check("a person renamed after tagging shows their current name", renamed.includes(`${TAG} שונה`),
      renamed.includes(`${TAG} שונה`) ? "current name" : "STALE LABEL");
    check("and not the name stored in the tag", !renamed.includes(`${TAG} נבדק`));

    console.log("\n=== the asker is told when an answer lands ===");
    // a fresh query with a live commander on both ends
    await dom.goto(`${BASE}/queries`);
    await dom.locator('form:has(button:text("שלח שאילתא")) input[name="title"]').fill(`${TAG} חיווי`);
    await dom.locator('form:has(button:text("שלח שאילתא")) textarea[name="body"]').fill("שאלה קצרה");
    await dom.locator('form:has(button:text("שלח שאילתא")) input[name="dueDate"]').fill(inDays(9));
    await dom.locator('button:text("שלח שאילתא")').click();
    await dom.waitForTimeout(2500);
    const nq = await prisma.query.findFirstOrThrow({ where: { title: `${TAG} חיווי` }, include: { targets: true } });

    // the sender opens the page, so nothing is outstanding for them
    await dom.goto(`${BASE}/queries`);
    await dom.waitForTimeout(1200);
    const beforeAnswer = await fullText(dom);
    check("no 'new answer' marker before anyone answers", !beforeAnswer.includes("תשובה חדשה"),
      !beforeAnswer.includes("תשובה חדשה") ? "clean" : "MARKER SHOWN TOO EARLY");

    await sec.goto(`${BASE}/queries`);
    const answerBox = sec.locator(`form:has(button:text("שלח תשובה")) textarea[name="answer"]`).first();
    await answerBox.fill("הנה התשובה שלי.");
    await sec.locator('button:text("שלח תשובה")').first().click();
    await sec.waitForTimeout(2500);

    const answeredRow = await prisma.queryTarget.findFirstOrThrow({ where: { queryId: nq.id, nodeId: sec1.id } });
    check("the answer is marked unseen by the sender", answeredRow.seenBySender === false);
    check("and a mail went out about it — the outcome is recorded", answeredRow.mailOk !== null, `mailOk=${answeredRow.mailOk}`);

    await dom.goto(`${BASE}/queries`);
    const withMarker = await fullText(dom);
    check("the sender sees the new-answer marker", withMarker.includes("תשובה חדשה"),
      withMarker.includes("תשובה חדשה") ? "marked" : "NO MARKER");
    check("and the header badge counted it", /שאילתות\s*[1-9]/.test(withMarker),
      /שאילתות\s*[1-9]/.test(withMarker) ? "badge lit" : "BADGE DARK");

    // opening the page is what clears it — and only AFTER the response
    await dom.waitForTimeout(1500);
    const cleared = await prisma.queryTarget.findFirstOrThrow({ where: { id: answeredRow.id } });
    check("having looked, it is no longer new", cleared.seenBySender === true);
    await dom.goto(`${BASE}/queries`);
    check("the marker is gone on the next visit", !(await fullText(dom)).includes("תשובה חדשה"));

    console.log("\n=== search ===");
    await dom.goto(`${BASE}/queries?q=${encodeURIComponent(`${TAG} חיווי`)}`);
    const found = await fullText(dom);
    check("searching by title finds the query", found.includes(`${TAG} חיווי`));
    check("and excludes the others", !found.includes(`${TAG} מצב הסמכות`),
      !found.includes(`${TAG} מצב הסמכות`) ? "filtered" : "OTHERS STILL SHOWN");
    await dom.goto(`${BASE}/queries?q=${encodeURIComponent("הנה התשובה שלי")}`);
    check("searching by ANSWER text finds it too", (await fullText(dom)).includes(`${TAG} חיווי`));
    await dom.goto(`${BASE}/queries?q=${encodeURIComponent("מדור א")}`);
    check("searching by framework name finds it", (await fullText(dom)).includes(`${TAG}`));
    await dom.goto(`${BASE}/queries?q=${encodeURIComponent("אין דבר כזה")}`);
    const empty = await fullText(dom);
    check("a search with no hits says so rather than looking empty", empty.includes("התואמות ל"),
      empty.includes("התואמות ל") ? "explained" : "SILENTLY EMPTY");

    console.log("\n=== deleting a query ===");
    await dom.goto(`${BASE}/queries?q=${encodeURIComponent(`${TAG} חיווי`)}`);
    const targetsBefore = await prisma.queryTarget.count({ where: { queryId: nq.id } });
    check("its recipient rows exist before the delete", targetsBefore === 2, `${targetsBefore}`);
    await dom.locator('button:text("מחק שאילתא")').first().click();
    await dom.waitForTimeout(2500);
    check("the query is gone", (await prisma.query.count({ where: { id: nq.id } })) === 0);
    check("and every recipient's copy with it", (await prisma.queryTarget.count({ where: { queryId: nq.id } })) === 0);

    await sec.goto(`${BASE}/queries`);
    check("the recipient no longer sees it either", !(await fullText(sec)).includes(`${TAG} חיווי`));

    console.log("\n=== משא״ן: a lateral sender ===");
    // granted over the domain, commanding nothing — the pair the change exists
    // to keep apart is this user and the domain's own commander
    // a framework nobody commands, created here: by this point in the run every
    // earlier one has been given a commander
    const orphanSec = await prisma.orgNode.create({
      data: { name: `${TAG} מדור ללא מפקד`, kind: "SECTION", parentId: domain.id },
    });
    const hrUser = await mk("hr", null, "HR");
    await prisma.accessGrant.create({ data: { userId: hrUser.id, nodeId: domain.id, level: "EDIT" } });
    const hr = await signIn(browser, `${TAG}-hr`);
    await hr.goto(`${BASE}/queries`);
    const hrText = await fullText(hr);
    check("the page opens for them though they command nothing", hrText.includes("שאילתות משא״ן"));
    // flipped by hr-as-query-recipient: an HR user IS addressable now, so the
    // for-me panel and the side chooser exist for them like for any commander
    check("the for-me panel exists for them — a person can be addressed now", hrText.includes("שאילתות עבורי"));
    check("and the side chooser with it", (await hr.locator('select[name="side"]').count()) === 1);
    check("they get a create form", (await hr.locator('button:text("שלח שאילתא")').count()) === 1);

    const hrBoxes = hr.locator('form:has(button:text("שלח שאילתא")) input[type="checkbox"]');
    check("nothing is pre-checked — there is no level below to default to",
      (await hrBoxes.evaluateAll((els) => els.filter((e) => (e as HTMLInputElement).checked).length)) === 0);
    check("no ‎@‎ picker: the reach IS the granted subtree",
      (await hr.locator('form:has(button:text("שלח שאילתא")) input[name="mention"], form:has(button:text("שלח שאילתא")) [placeholder*="@"]').count()) === 0);
    // scoped to the chooser, not the whole page: sec2 has no commander, so it
    // must not be a choosable row for a sender who can appoint nobody
    const hrPickerText = await hr
      .locator('form:has(button:text("שלח שאילתא")) ul')
      .first()
      .innerText();
    check("an uncommanded framework is not offered to them at all", !hrPickerText.includes(orphanSec.name),
      !hrPickerText.includes(orphanSec.name) ? "absent" : "OFFERED A ROW NOBODY CAN ANSWER");
    check("while the commanded ones are", hrPickerText.includes(`${TAG} מדור א`) && hrPickerText.includes(`${TAG} צוות`));

    // the role is operational, not configurational: the same refusals a Manager
    // meets. Asserted rather than assumed, because "HR is like a Manager" is
    // exactly the kind of claim that is true until someone adds a role check.
    await hr.goto(`${BASE}/people/card-schema`);
    const schemaPage = await fullText(hr);
    check("משא״ן cannot reach the card-schema configuration",
      schemaPage.includes("לאדמין בלבד") || schemaPage.includes("אין לך הרשאה") || !schemaPage.includes("שדות כרטיס"),
      schemaPage.slice(0, 60));
    await hr.goto(`${BASE}/access`);
    const accessPage = await fullText(hr);
    check("...and cannot create users or grants there",
      !accessPage.includes("משתמש חדש") && (await hr.locator('select[name="role"]').count()) === 0);
    await hr.goto(`${BASE}/queries`);

    // choose the section and the team — a commanded team three levels down
    await hr.locator(`label:has-text("${TAG} מדור א") input[type="checkbox"]`).first().check();
    await hr.locator(`label:has-text("${TAG} צוות") input[type="checkbox"]`).first().check();
    await hr.fill('input[name="title"]', `${TAG} סקר משאבי אנוש`);
    await hr.fill('textarea[name="body"]', "נא לדווח על מצב כוח האדם.");
    await hr.locator('form:has(button:text("שלח שאילתא")) input[name="dueDate"]').fill(inDays(7));
    await hr.locator('button:text("שלח שאילתא")').click();
    await hr.waitForTimeout(2500);

    const hq = await prisma.query.findFirst({ where: { title: `${TAG} סקר משאבי אנוש` }, include: { targets: true } });
    check("the query was created", !!hq);
    check("recorded as sent by a person, not by a framework", hq?.senderKind === "STAFF");
    check("credited to the HR user", hq?.authorId === hrUser.id);
    check("reaching the two chosen frameworks, including the team", hq?.targets.length === 2,
      `${hq?.targets.length} targets`);

    // the leak: the domain's own commander must see nothing of it
    await dom.goto(`${BASE}/queries`);
    check("the domain commander does not see it among what their framework sent",
      !(await fullText(dom)).includes(`${TAG} סקר משאבי אנוש`),
      !(await fullText(dom)).includes(`${TAG} סקר משאבי אנוש`) ? "invisible" : "LEAKED TO THE COMMANDER");

    // the recipients see a PERSON, not the framework it was made under
    await sec.goto(`${BASE}/queries`);
    const secOnHr = await fullText(sec);
    check("the addressed commander sees the query", secOnHr.includes(`${TAG} סקר משאבי אנוש`));
    check("...attributed to משא״ן and the person", secOnHr.includes(`משא״ן · ${TAG}-hr`),
      secOnHr.includes(`משא״ן · ${TAG}-hr`) ? "named as a person" : "READS AS A FRAMEWORK");
    check("...and never as the framework it was made under",
      !new RegExp(`מאת ${TAG} תחום`).test(secOnHr));

    await sec.locator(`form:has(button:text("שלח תשובה")) textarea[name="answer"]`).first().fill("שנים עשר אנשים.");
    await sec.locator('button:text("שלח תשובה")').first().click();
    await sec.waitForTimeout(2000);
    const hrAnswered = await prisma.queryTarget.findFirstOrThrow({ where: { queryId: hq!.id, nodeId: sec1.id } });
    check("the commander answers as their framework, exactly as to a commander", hrAnswered.answer === "שנים עשר אנשים.");

    await hr.goto(`${BASE}/queries`);
    const hrAfter = await fullText(hr);
    check("the HR sender reads the answer", hrAfter.includes("שנים עשר אנשים."));
    check("and the tally counts it", hrAfter.includes("1/2"), hrAfter.includes("1/2") ? "1/2" : "tally missing");

    hr.on("dialog", (d) => d.accept()); // the close button confirms first
    await hr.locator('button:text("סגור שאילתא")').first().click();
    await hr.waitForTimeout(2500);
    check("the HR sender closes their own query",
      (await prisma.query.findUniqueOrThrow({ where: { id: hq!.id } })).closedAt !== null);

    // and deleting them closes rather than orphans
    await prisma.query.update({ where: { id: hq!.id }, data: { closedAt: null } });
    const admin2 = await signIn(browser, `${TAG}-admin2`);
    await admin2.goto(`${BASE}/access`);
    admin2.on("dialog", (d) => d.accept());
    await admin2.locator(`form:has(input[value="${hrUser.id}"]) button:text("מחק משתמש")`).first().click();
    await admin2.waitForTimeout(2500);
    const afterDelete = await prisma.query.findUnique({ where: { id: hq!.id }, include: { targets: true } });
    const userGone = (await prisma.user.count({ where: { id: hrUser.id } })) === 0;
    check("the HR user was deleted", userGone);
    if (userGone) {
      check("their open query was CLOSED, not left for nobody to close", afterDelete?.closedAt !== null);
      check("and not deleted — the commander's answer survives",
        afterDelete?.targets.some((t) => t.answer === "שנים עשר אנשים.") === true);
    }


    console.log("\n=== a team commander asks their משא״ן ===");
    // fresh pair: the lateral section deleted its HR user at its end
    const hrTend = await mk("hrtend", null, "HR");
    await prisma.accessGrant.create({ data: { userId: hrTend.id, nodeId: sec1.id, level: "EDIT" } }); // covers the team by inheritance
    await teamPage.goto(`${BASE}/queries`);
    check("the team commander NOW has a create form — the HR channel unlocked it",
      (await teamPage.locator('button:text("שלח שאילתא")').count()) === 1,
      "was refused before an eligible HR existed");
    const teamForm = teamPage.locator('form:has(button:text("שלח שאילתא"))');
    check("with the HR chip offered by name", (await teamForm.locator(`label:has-text("${TAG}-hrtend")`).count()) === 1);
    check("no framework checkboxes and no ‎@‎ — teams still do not address frameworks",
      (await teamForm.locator('[placeholder*="הוסף מפקד"]').count()) === 0);

    await teamForm.locator(`label:has-text("${TAG}-hrtend") input[type="checkbox"]`).check();
    await teamForm.locator('input[name="title"]').fill(`${TAG} קליטת דנה`);
    await teamForm.locator('textarea[name="body"]').fill("מה מצב הקליטה?");
    await teamForm.locator('input[name="dueDate"]').fill(inDays(5));
    await teamForm.locator('button:text("שלח שאילתא")').click();
    await teamPage.waitForTimeout(2500);

    const pq = await prisma.query.findFirst({ where: { title: `${TAG} קליטת דנה` }, include: { targets: true } });
    check("the query was created", !!pq);
    check("with the PERSON as its target — no framework row", pq?.targets.length === 1 && pq?.targets[0].targetUserId === hrTend.id && pq?.targets[0].nodeId === null);
    check("and mailed to the person's own address, outcome recorded",
      (await prisma.queryTarget.findFirstOrThrow({ where: { queryId: pq!.id } })).mailOk !== null);

    const hrT = await signIn(browser, `${TAG}-hrtend`);
    await hrT.goto(`${BASE}/queries`);
    const hrTText = await fullText(hrT);
    check("the HR user sees it in שאילתות עבורי", hrTText.includes(`${TAG} קליטת דנה`));
    check("with the badge counting it", /שאילתות\s*[1-9]/.test(hrTText), "badge lit");
    await hrT.locator(`form:has(button:text("שלח תשובה")) textarea[name="answer"]`).first().fill("דנה נקלטה היטב.");
    await hrT.locator('button:text("שלח תשובה")').first().click();
    await hrT.waitForTimeout(2000);
    const pAnswered = await prisma.queryTarget.findFirstOrThrow({ where: { queryId: pq!.id } });
    check("they answer as themselves", pAnswered.answer === "דנה נקלטה היטב." && pAnswered.answeredById === hrTend.id);

    await teamPage.goto(`${BASE}/queries`);
    const teamReads = await fullText(teamPage);
    check("the sender reads the answer under the person's name",
      teamReads.includes("דנה נקלטה היטב.") && teamReads.includes(`${TAG}-hrtend`));

    // lapsed coverage: shown, not repaired, and the row still answerable
    await prisma.accessGrant.deleteMany({ where: { userId: hrTend.id } });
    await teamPage.goto(`${BASE}/queries`);
    check("a lapsed grant is SHOWN on the sender's row, never silently repaired",
      (await fullText(teamPage)).includes("פקעה"), "the lapse marking");

    console.log("\n=== a mixed audience: frameworks and a person in one query ===");
    await prisma.accessGrant.create({ data: { userId: hrTend.id, nodeId: domain.id, level: "EDIT" } });
    await dom.goto(`${BASE}/queries`);
    const domForm = dom.locator('form:has(button:text("שלח שאילתא"))');
    await domForm.locator(`label:has-text("${TAG}-hrtend") input[type="checkbox"]`).check();
    await domForm.locator('input[name="title"]').fill(`${TAG} מעורבת`);
    await domForm.locator('textarea[name="body"]').fill("לשני המדורים ולמשא״ן.");
    await domForm.locator('input[name="dueDate"]').fill(inDays(5));
    await domForm.locator('button:text("שלח שאילתא")').click();
    await dom.waitForTimeout(2500);
    const mixed = await prisma.query.findFirst({ where: { title: `${TAG} מעורבת` }, include: { targets: true } });
    const personRows = mixed?.targets.filter((t) => t.targetUserId).length ?? 0;
    const frameworkRows = mixed?.targets.filter((t) => t.nodeId).length ?? 0;
    check("framework rows AND one person row in a single query", personRows === 1 && frameworkRows === 3,
      `${frameworkRows} frameworks + ${personRows} person (domain has 3 children by now)`);
    check("and the sender's tally counts them all", (await fullText(dom)).includes(`0/${frameworkRows + personRows}`),
      `0/${frameworkRows + personRows} in the list`);

  } finally {
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
