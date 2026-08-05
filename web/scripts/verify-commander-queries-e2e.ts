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

  const mk = async (handle: string, node: string | null, role: "ADMIN" | "MANAGER" = "MANAGER") =>
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
    check("but does get the received section", (await fullText(teamPage)).includes("שאילתות רמה ממונה"));

    console.log("\n=== sending ===");
    const dom = await signIn(browser, `${TAG}-dom`);
    await dom.goto(`${BASE}/queries`);
    check("a domain commander gets the create form", (await dom.locator('button:text("שלח שאילתא")').count()) === 1);
    check("and no received section — nothing is addressed to them yet, but the heading exists",
      (await fullText(dom)).includes("שאילתות רמה ממונה"));

    await dom.fill('input[name="title"]', `${TAG} מצב הסמכות`);
    await dom.fill('textarea[name="body"]', "נא לדווח על מצב ההסמכות ברבעון.");
    await dom.locator('form:has(button:text("שלח שאילתא")) input[name="dueDate"]').fill(inDays(7));
    await dom.locator('button:text("שלח שאילתא")').click();
    await dom.waitForTimeout(2500);

    const q = await prisma.query.findFirst({ where: { title: `${TAG} מצב הסמכות` }, include: { targets: true } });
    check("the query was created", !!q);
    check("with one row per section, exactly one level down", q?.targets.length === 2, `${q?.targets.length} targets`);
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
    const secClosed = await fullText(sec);
    const stillEditable = await sec.locator('textarea[name="answer"]').count();
    check("the target can no longer edit", stillEditable === 0, stillEditable === 0 ? "form gone" : "FORM STILL PRESENT");
    check("and is told the sender closed it, not that a date passed",
      secClosed.includes("השאילתא נסגרה"), secClosed.includes("השאילתא נסגרה") ? "correct reason shown" : "WRONG REASON");
    check("the header count drops to nothing", !/שאילתות\s*[1-9]/.test(secClosed),
      !/שאילתות\s*[1-9]/.test(secClosed) ? "badge clear" : "BADGE STILL COUNTING");

    await dom.goto(`${BASE}/queries`);
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
