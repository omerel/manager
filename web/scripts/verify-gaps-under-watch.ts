/**
 * Verification for gaps-under-watch.
 *
 * Three things are under test, and the second is the dangerous one.
 *
 * 1. A watch DISTINGUISHES a known gap from a new one and never reduces the
 *    count of gaps. Marking must be unable to make anyone look better.
 *
 * 2. `PointProgress` used to mean "done"; a row with no `doneOn` now means
 *    "under watch". Readers said "done" in their own way — `!!prog`, a `_count`,
 *    a set of ids — and most of them would NOT have failed to compile against
 *    the new meaning. The sweep below is the guard for the ones that wouldn't.
 *
 * 3. Expiry returns an item to the gap it was, and NEVER to green. The case
 *    that makes this hard is a recurring occurrence that has an `EvalEntry`:
 *    forget it, and a month of nobody looking closes the gap by itself.
 *
 *   npx tsx --env-file=.env scripts/verify-gaps-under-watch.ts
 */
import { execSync } from "node:child_process";
import { chromium } from "playwright";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { addMonths } from "@/lib/dates";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { computePersonGaps, isPointDone, isPointWatched, NO_WATCHES, type WatchContext } from "@/lib/gaps";
import { GAP_META, GAP_KIND_LABEL, GAP_KIND_ORDER, parseGapKind, type GapLevel } from "@/lib/gap-meta";
import { buildGapTree, findNode, isAttention } from "@/lib/gap-dashboard";
import { computeVisibility } from "@/lib/access";
import { getPersonFull, buildPersonTimeline, buildVectorView } from "@/lib/person-view";
import { buildPlanDiagramSvg, planDiagramStatusGaps, occurrenceKey, STATUS_STYLE, VECTOR_LEGEND, type VectorStatus } from "@/lib/plan-diagram";
import { watchContextFor, getWatchExpiryDays, setWatchExpiryDays, WATCH_EXPIRY_DEFAULT_DAYS, WATCH_EXPIRY_KEY } from "@/lib/watch";
import { isWatchLive, watchAgeDays } from "@/lib/watch-rules";

const TAG = "gwverify";
const BASE = process.env.BASE_URL ?? "http://localhost:4321";

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
  // the expiry setting is global: a run that changed it must put it back
  await prisma.appSetting.deleteMany({ where: { key: WATCH_EXPIRY_KEY } });
}

/* ------------------------------------------------------------------ *
 * the static guards: one answer to "is this done?"                    *
 * ------------------------------------------------------------------ */

/**
 * Files allowed to touch `pointProgress` freely: the predicate's own home, the
 * writers, and the serialisers that move rows verbatim without asking what they
 * mean.
 */
const RAW_OK = new Set([
  "src/lib/gaps.ts", // defines the predicate and routes its own reader through it
  "src/lib/portability.ts", // exports and imports rows verbatim
  "src/lib/apply-proposal.ts", // writes completion from an approved proposal
  "src/lib/person-actions.ts", // the writers themselves
  "src/lib/hr-update.ts", // include: true, never reads the field
]);

/**
 * Sites that merely NAME or FETCH the relation — a query `include`, a type
 * field, a count display, a Map that retrieves the row so someone downstream
 * can ask the question properly. None of them decides "is it done?".
 *
 * Pinned by exact source TEXT, not by line number: line numbers drift with every
 * edit above them, so pinning them would make this check rot into noise. A new
 * reader is new text, and new text fails here — which is the whole purpose.
 */
const SHAPE_ONLY = [
  "pointProgress: number;", // DeletionImpact's field
  "i.pointProgress === 0 &&", // "nothing else would be destroyed" — a count, not a state
  "pointProgress: true,", // query includes (several files)
  "const doneByEvent = new Map(person.pointProgress.map((p) => [p.pointEventId, p]));", // fetch; the read is routed
  "const prog = p.pointProgress.find((x) => x.pointEventId === e.id);", // ditto
  'impact.pointProgress && plural(impact.pointProgress, "אבן דרך שסומנה", "אבני דרך שסומנו"),', // count display
  "const doneIds = new Set(person.pointProgress.filter(isPointDone).map((pp) => pp.pointEventId));", // routed
  // `people.ts` is deliberately NOT in RAW_OK: pinning its `where` here means
  // that deleting the filter — and letting a watch row inflate «אבני דרך שסומנו»
  // — fails this check rather than passing silently.
  "pointProgress: { where: { doneOn: { not: null } } },",
  "pointProgress: p._count.pointProgress,", // the filtered count, twice (list + single)
];

function grep(pattern: string): string[] {
  return execSync(
    `grep -rn ${JSON.stringify(pattern)} src --include='*.ts' --include='*.tsx' | grep -v "src/generated" || true`,
    { encoding: "utf8" },
  ).trim().split("\n").filter(Boolean);
}

/** Lines naming `pointProgress` that are neither allowlisted nor shape-only. */
function sweepRelation(): string[] {
  return grep("pointProgress").filter((h) => {
    const [file, , ...rest] = h.split(":");
    if (RAW_OK.has(file)) return false;
    return !SHAPE_ONLY.includes(rest.join(":").trim());
  });
}

/**
 * The fault, re-entering under any name. `!!prog` on a row whose `doneOn` is
 * null is still true — so this looks for presence-as-completion on anything
 * called prog/progress, regardless of which relation it came from.
 */
function sweepIdiom(): string[] {
  const hits = execSync(
    `grep -rnE "(!!|!)prog(ress)?\\b|\\bprog(ress)? (!|=)== (null|undefined)" src --include='*.ts' --include='*.tsx' | grep -v "src/generated" || true`,
    { encoding: "utf8" },
  ).trim().split("\n").filter(Boolean);
  return hits.filter((h) => !RAW_OK.has(h.split(":")[0]));
}

/* ------------------------------------------------------------------ */

const PLACEMENT_MONTHS_AGO = 25;

/** Everything the suite builds, so the checks below read as statements not setup. */
async function buildFixtures(today: Date) {
  const placement = addMonths(today, -PLACEMENT_MONTHS_AGO);

  const center = await prisma.orgNode.create({ data: { name: `${TAG} מרכז`, kind: "CENTER" } });
  const domain = await prisma.orgNode.create({ data: { name: `${TAG} תחום`, kind: "DOMAIN", parentId: center.id } });
  const section = await prisma.orgNode.create({ data: { name: `${TAG} מדור`, kind: "SECTION", parentId: domain.id } });
  const team = await prisma.orgNode.create({ data: { name: `${TAG} צוות`, kind: "TEAM", parentId: section.id } });

  const editor = await prisma.user.create({
    data: {
      name: `${TAG} רמ״ד`, email: `${TAG}e@v.invalid`, username: `${TAG}-editor`,
      passwordHash: hashPassword("x"), role: "MANAGER",
      grants: { create: [{ nodeId: section.id, level: "EDIT" }] },
    },
  });
  // VIEW only: may read the card, may not mark anything on it
  const viewer = await prisma.user.create({
    data: {
      name: `${TAG} צופה`, email: `${TAG}v@v.invalid`, username: `${TAG}-viewer`,
      passwordHash: hashPassword("x"), role: "MANAGER",
      grants: { create: [{ nodeId: section.id, level: "VIEW" }] },
    },
  });

  // All three kinds, all of them already overdue at `today`: a watch is a mark
  // on a SHORTFALL, so a fixture whose items are not yet due would test nothing.
  const plan = await prisma.careerPlan.create({
    data: {
      name: `${TAG} מסלול`, isTemplate: false,
      pointEvents: { create: [{ label: `${TAG} אבן דרך`, offsetMonths: 6 }] },
      cumulativeMetrics: {
        create: [{ name: `${TAG} מדד`, unit: "שעות", checkpoints: { create: [{ offsetMonths: 6, target: 100 }] } }],
      },
      recurringEvents: {
        create: [{
          label: `${TAG} ראיון`, intervalMonths: 6, startOffsetMonths: 6,
          stopMode: "UNTIL_OFFSET", stopOffsetMonths: 36, display: "CARD",
        }],
      },
    },
    include: { pointEvents: true, cumulativeMetrics: { include: { checkpoints: true } }, recurringEvents: true },
  });

  const person = await prisma.person.create({
    data: {
      firstName: TAG, lastName: "נבדק", fullName: `${TAG} נבדק`,
      recruitmentDate: placement, placementDate: placement, teamId: team.id, assignedPlanId: plan.id,
    },
  });
  await prisma.planAssignment.create({
    data: { personId: person.id, planId: plan.id, templateName: plan.name, assignedAt: placement, waiverOffsetMonths: 0 },
  });

  return {
    center, domain, section, team, editor, viewer, person, plan, placement,
    point: plan.pointEvents[0],
    metric: plan.cumulativeMetrics[0],
    recurring: plan.recurringEvents[0],
  };
}

type Fixtures = Awaited<ReturnType<typeof buildFixtures>>;

/** The person, loaded the way every gap reader loads them. */
async function loadForGaps(personId: string) {
  return prisma.person.findUniqueOrThrow({
    where: { id: personId },
    include: {
      pointProgress: true,
      metricReadings: true,
      evalEntries: { select: { recurringEventId: true, occurrenceOffset: true } },
      assignedPlan: {
        include: {
          pointEvents: true,
          cumulativeMetrics: { include: { checkpoints: true } },
          recurringEvents: true,
          assignment: { select: { waiverOffsetMonths: true, waivers: true } },
        },
      },
    },
  });
}

async function mark(personId: string, itemKey: string, markedAt: Date) {
  await prisma.watchMark.upsert({
    where: { personId_itemKey: { personId, itemKey } },
    create: { personId, itemKey, markedAt },
    update: { markedAt },
  });
}

async function main() {
  await cleanup();
  const today = new Date();
  let fx: Fixtures | null = null;

  try {
    console.log("=== one answer to 'is this point done?' ===");
    check("a row carrying a date is done", isPointDone({ doneOn: new Date() }));
    check("a row with no date is NOT done", !isPointDone({ doneOn: null }), "this is the whole fault");
    check("no row at all is not done", !isPointDone(null) && !isPointDone(undefined));
    check("a row with no date IS a watch", isPointWatched({ doneOn: null }));
    check("a completed row is not a watch", !isPointWatched({ doneOn: new Date() }));
    check("no row at all is not a watch", !isPointWatched(null));
    check("done and watched are mutually exclusive",
      [{ doneOn: new Date() }, { doneOn: null }].every((r) => !(isPointDone(r) && isPointWatched(r))));

    console.log("\n=== nobody asks the question another way ===");
    const where = (hits: string[]) => hits.map((s) => s.split(":").slice(0, 2).join(":")).join(", ");
    const strays = sweepRelation();
    check("every site touching pointProgress is a writer, a shape, or routed",
      strays.length === 0,
      strays.length ? `${strays.length} unaccounted: ${where(strays.slice(0, 4))}` : "none");
    const idioms = sweepIdiom();
    check("nobody tests a progress row for presence instead of completion",
      idioms.length === 0, idioms.length ? `${idioms.length}: ${where(idioms)}` : "none");
    const live = grep("pointProgress").map((h) => h.split(":").slice(2).join(":").trim());
    const stale = SHAPE_ONLY.filter((s) => !live.includes(s));
    check("no stale pin in SHAPE_ONLY", stale.length === 0,
      stale.length ? `${stale.length} pinned shapes no longer exist: ${stale.join(" | ")}` : "all pins live");

    console.log("\n=== the measurement vocabulary did not grow ===");
    // A fifth GapLevel is the failure this change was shaped to avoid: it would
    // have made a watched item stop counting as the gap it is.
    check("GapLevel is still exactly four", Object.keys(GAP_META).length === 4, Object.keys(GAP_META).join(", "));
    check("and none of them is a watch",
      !Object.keys(GAP_META).some((k) => /WATCH/i.test(k)), "a watch is a flag, not a level");
    // the DISPLAY vocabulary did grow, and its two halves must not disagree
    check("every VectorStatus has a legend entry",
      Object.keys(STATUS_STYLE).every((s) => VECTOR_LEGEND.some((l) => l.status === s)),
      `${Object.keys(STATUS_STYLE).length} statuses, ${VECTOR_LEGEND.length} legend rows`);
    check("the legend names a watch as a GAP, not as a state of its own",
      VECTOR_LEGEND.find((l) => l.status === "WATCHED")?.label.includes("פער") === true,
      VECTOR_LEGEND.find((l) => l.status === "WATCHED")?.label ?? "missing");
    check("every GapKind is offered by the filter",
      Object.keys(GAP_KIND_LABEL).every((k) => GAP_KIND_ORDER.includes(k as never)),
      `${GAP_KIND_ORDER.length} offered of ${Object.keys(GAP_KIND_LABEL).length}`);
    check("the fourth kind survives a round trip through the URL",
      parseGapKind("overdue-unwatched") === "overdue-unwatched");

    fx = await buildFixtures(today);

    console.log("\n=== all three kinds can be marked ===");
    const before = computePersonGaps(await loadForGaps(fx.person.id), today);
    const overdueBefore = before.items.filter((i) => i.level === "OVERDUE");
    check("the fixture starts with three overdue items, one of each kind",
      overdueBefore.length === 3 && new Set(overdueBefore.map((i) => i.kind)).size === 3,
      overdueBefore.map((i) => i.kind).join(", "));

    /**
     * A recurring GapItem stands for EVERY overdue occurrence of its event, not
     * for one — so acknowledging it means acknowledging all of them. That is the
     * rule on purpose: one marked month must not silence the three behind it.
     * The suite's first draft marked a single occurrence and read "2 of 3",
     * which was the rule working, not failing.
     */
    const overdueOffsets = [6, 12, 18, 24].filter((o) => o <= PLACEMENT_MONTHS_AGO);
    const recurringId = fx.recurring.id; // `fx` is a let; the closure below would lose its narrowing
    const occurrenceKeys = overdueOffsets.map((o) => occurrenceKey(recurringId, o));
    const firstOccurrence = occurrenceKeys[0];
    check("the recurring event has more than one overdue occurrence",
      occurrenceKeys.length > 1, `${occurrenceKeys.length} past due`);
    for (const k of [fx.point.id, fx.metric.id, ...occurrenceKeys]) await mark(fx.person.id, k, today);

    const after = computePersonGaps(await loadForGaps(fx.person.id), today, await watchContextFor(fx.person.id, today));
    check("every one of the three reports as watched",
      after.items.filter((i) => i.watched).length === 3,
      `${after.items.filter((i) => i.watched).length} of 3`);

    // and the converse, stated rather than assumed
    await prisma.watchMark.deleteMany({ where: { personId: fx.person.id, itemKey: occurrenceKeys[1] } });
    const partial = computePersonGaps(await loadForGaps(fx.person.id), today, await watchContextFor(fx.person.id, today));
    check("ONE unmarked occurrence is enough to keep the event unacknowledged",
      partial.items.find((i) => i.kind === "recurring")?.watched === false,
      "one marked month must not silence the ones behind it");
    await mark(fx.person.id, occurrenceKeys[1], today);

    console.log("\n=== THE CORE: marking cannot make anyone look better ===");
    check("the overdue count is identical",
      after.items.filter((i) => i.level === "OVERDUE").length === overdueBefore.length,
      `${overdueBefore.length} before, ${after.items.filter((i) => i.level === "OVERDUE").length} after`);
    check("the person's rolled-up status is identical",
      after.status === before.status, `${before.status} → ${after.status}`);
    check("EVERY item kept its level",
      after.items.every((it, i) => it.level === before.items[i].level), "a watch is a flag beside the level");
    check("and its detail text",
      after.items.every((it, i) => it.detail === before.items[i].detail), "nothing the engine reports changed");

    // the same question of the dashboard, at every height of the tree
    const editorGrants = await prisma.accessGrant.findMany({ where: { userId: fx.editor.id } });
    const vis = await computeVisibility({ id: fx.editor.id, name: fx.editor.name, role: "MANAGER", grants: editorGrants });
    const tree = await buildGapTree(vis, today);
    const teamNode = findNode(tree, fx.team.id);
    const sectionNode = findNode(tree, fx.section.id);
    check("the team's overdue-event count is the three we started with",
      teamNode?.overdueEvents === 3, `${teamNode?.overdueEvents}`);
    check("and every one of them is reported as watched, not removed",
      teamNode?.watchedEvents === 3, `${teamNode?.watchedEvents} watched of ${teamNode?.overdueEvents} overdue`);
    check("the framework above rolls up the same way",
      sectionNode?.overdueEvents === 3 && sectionNode?.watchedEvents === 3,
      `${sectionNode?.overdueEvents} overdue / ${sectionNode?.watchedEvents} watched`);
    check("the watched count is a SUBSET and never exceeds the overdue count",
      (teamNode?.watchedEvents ?? 0) <= (teamNode?.overdueEvents ?? 0));
    check("the age of the oldest watch is reported, so an old one is visible",
      sectionNode?.oldestWatchDays === 0, `${sectionNode?.oldestWatchDays} days`);

    /**
     * The compliance gauge is `100 - red/total`, and the framework comparison
     * reads the same three numbers. None of them may move when a gap is merely
     * acknowledged — a gauge that rose because someone ticked a box would be the
     * exact lie this whole change is shaped to avoid.
     */
    check("the people-counts the gauge is built from are untouched",
      teamNode?.total === 1 && teamNode?.red === 1 && teamNode?.yellow === 0,
      `total ${teamNode?.total}, red ${teamNode?.red}, yellow ${teamNode?.yellow}`);
    check("so the compliance figure is identical with every gap marked",
      100 - Math.round(((teamNode?.red ?? 0) / (teamNode?.total ?? 1)) * 100) === 0,
      "still 0% — acknowledging a gap is not meeting it");

    console.log("\n=== the filter returns exactly what was NOT marked ===");
    const person = { status: "OVERDUE" as GapLevel, hasUnwatchedOverdue: false };
    check("someone whose every overdue item is marked drops out of ״אינה במעקב״",
      !isAttention(person, "overdue-unwatched"));
    check("and is still there under plain ״אי-עמידה״", isAttention(person, "overdue"));
    const teamPeople = teamNode?.people ?? [];
    check("the tree agrees: this person has no unwatched overdue item left",
      teamPeople.length === 1 && teamPeople[0].hasUnwatchedOverdue === false,
      `${teamPeople.length} people`);
    // unmark one, and they must come straight back
    await prisma.watchMark.deleteMany({ where: { personId: fx.person.id, itemKey: fx.point.id } });
    const treeAgain = await buildGapTree(vis, today);
    const again = findNode(treeAgain, fx.team.id);
    check("clearing ONE mark brings them back into ״אינה במעקב״",
      again?.people[0].hasUnwatchedOverdue === true);
    check("and the overdue count still has not moved", again?.overdueEvents === 3, `${again?.overdueEvents}`);
    await mark(fx.person.id, fx.point.id, today); // put it back

    console.log("\n=== a completed item is not a watch ===");
    await prisma.pointProgress.create({
      data: { personId: fx.person.id, pointEventId: fx.point.id, doneOn: addMonths(today, -1), note: `${TAG} בוצע` },
    });
    const withDone = await loadForGaps(fx.person.id);
    check("the completed point reads as done", isPointDone(withDone.pointProgress[0]));
    check("and NOT as a watch", !isPointWatched(withDone.pointProgress[0]), "the two are exclusive by construction");
    const doneGaps = computePersonGaps(withDone, today, await watchContextFor(fx.person.id, today));
    check("a completed item is MET even while a stale mark sits on it",
      doneGaps.items.find((i) => i.kind === "point")?.level === "MET",
      "completion outranks a mark — the item is closed, not merely known");
    await prisma.pointProgress.deleteMany({ where: { personId: fx.person.id } });

    console.log("\n=== expiry returns to the gap, never to green ===");
    const expiry = await getWatchExpiryDays();
    check("the default window is a month", expiry === WATCH_EXPIRY_DEFAULT_DAYS, `${expiry} days`);
    check("a mark placed today is live", isWatchLive(today, expiry, today));
    check("one placed a day before the window closes is still live",
      isWatchLive(addMonths(today, 0), expiry, today) && isWatchLive(new Date(today.getTime() - (expiry - 1) * 86400000), expiry, today));
    check("one placed exactly a window ago has lapsed",
      !isWatchLive(new Date(today.getTime() - expiry * 86400000), expiry, today));
    check("the age is reported in whole days",
      watchAgeDays(new Date(today.getTime() - 3 * 86400000), today) === 3);

    // THE case: a recurring occurrence that HAS content, marked, then lapsed.
    await prisma.evalEntry.create({
      data: {
        personId: fx.person.id, kind: "FREE", title: `${TAG} פתק`, content: `${TAG} ידוע`,
        eventDate: today, recurringEventId: fx.recurring.id, occurrenceOffset: 6,
      },
    });
    const filledLive = computePersonGaps(await loadForGaps(fx.person.id), today, await watchContextFor(fx.person.id, today));
    const recLive = filledLive.items.find((i) => i.kind === "recurring");
    check("an occurrence with content, while MARKED, is still a gap",
      recLive?.level === "OVERDUE" && recLive?.watched === true,
      `${recLive?.level}, watched=${recLive?.watched}`);

    // age the mark past the window
    const lapsedAt = new Date(today.getTime() - (expiry + 2) * 86400000);
    for (const k of occurrenceKeys) await mark(fx.person.id, k, lapsedAt);
    const lapsed = computePersonGaps(await loadForGaps(fx.person.id), today, await watchContextFor(fx.person.id, today));
    const recLapsed = lapsed.items.find((i) => i.kind === "recurring");
    check("once the mark LAPSES it goes back to being an ordinary gap",
      recLapsed?.level === "OVERDUE", `${recLapsed?.level}`);
    check("and specifically NOT to MET — the entry must not close it by default",
      recLapsed?.level !== "MET",
      "a false green costs an obligation nobody sees again; a false red costs a glance");
    check("a lapsed mark no longer reports as watched",
      recLapsed?.watched === false, "the acknowledgement ended, the mark did not");

    console.log("\n=== the expiry setting applies to what is ALREADY marked ===");
    await setWatchExpiryDays(expiry + 10); // widen it
    const widened = computePersonGaps(await loadForGaps(fx.person.id), today, await watchContextFor(fx.person.id, today));
    check("widening the window revives a mark that had lapsed",
      widened.items.find((i) => i.kind === "recurring")?.watched === true,
      "expiry is computed at read time, so it was never written to the row");
    await setWatchExpiryDays(null);
    const restored = computePersonGaps(await loadForGaps(fx.person.id), today, await watchContextFor(fx.person.id, today));
    check("and narrowing it back lets the same mark lapse again",
      restored.items.find((i) => i.kind === "recurring")?.watched === false);
    for (const k of occurrenceKeys) await mark(fx.person.id, k, today); // live again for the drawing
    await prisma.evalEntry.deleteMany({ where: { personId: fx.person.id } });

    console.log("\n=== the drawing says the same thing the card does ===");
    // one marked item and one unmarked, on the SAME person, so the two colours
    // have to come from the same render
    await prisma.watchMark.deleteMany({ where: { personId: fx.person.id, itemKey: fx.metric.id } });
    const full = await getPersonFull(fx.person.id);
    const timeline = buildPersonTimeline(full!);
    const watches = await watchContextFor(fx.person.id, today);
    const view = buildVectorView(timeline, full!.placementDate, today, watches);
    check("the marked point is drawn WATCHED", view.status.get(fx.point.id) === "WATCHED", view.status.get(fx.point.id));
    const cp = full!.assignedPlan!.cumulativeMetrics[0].checkpoints[0];
    check("the unmarked metric on the same person is drawn OVERDUE",
      view.status.get(cp.id) === "OVERDUE", view.status.get(cp.id));
    // the person's own plan copy, exactly as the card passes it. A hand-built
    // stand-in crashed on `plan.name` — `as never` had silenced the compiler
    // that would otherwise have said so.
    const planForDraw = full!.assignedPlan!;
    const svg = buildPlanDiagramSvg(planForDraw, view.status, view.occurrences);
    // reported from the render itself — a parallel model of "what gets drawn" is
    // the very fault this reporting exists to catch
    const missingStatus = planDiagramStatusGaps(planForDraw, view.status, view.occurrences);
    check("the render itself reports no item it could not colour",
      missingStatus.length === 0, missingStatus.join(", ") || "none");
    const paints = (s: VectorStatus) => svg.split(STATUS_STYLE[s].accent).length - 1;
    check("orange appears in the drawing", paints("WATCHED") > 0, `${paints("WATCHED")} uses`);
    check("red appears too, on the same drawing", paints("OVERDUE") > 0, `${paints("OVERDUE")} uses`);
    check("and the eye glyph is drawn, so the state survives greyscale",
      svg.includes("<ellipse"), "colour is never the only carrier");

    console.log("\n=== what the engine reports is unchanged for anyone unmarked ===");
    const clean = await prisma.person.create({
      data: {
        firstName: TAG, lastName: "ללא-סימון", fullName: `${TAG} ללא-סימון`,
        recruitmentDate: fx.placement, placementDate: fx.placement, teamId: fx.team.id, assignedPlanId: fx.plan.id,
      },
    });
    const cleanPerson = await loadForGaps(clean.id);
    const noArg = computePersonGaps(cleanPerson, today);
    const emptyCtx = computePersonGaps(cleanPerson, today, new Map() as WatchContext);
    const noWatches = computePersonGaps(cleanPerson, today, NO_WATCHES);
    const same = (a: typeof noArg, b: typeof noArg) =>
      JSON.stringify(a.items.map((i) => [i.level, i.detail, i.watched])) ===
      JSON.stringify(b.items.map((i) => [i.level, i.detail, i.watched]));
    check("no context, an empty context and NO_WATCHES agree exactly",
      same(noArg, emptyCtx) && same(noArg, noWatches));
    check("and nothing reports as watched", noArg.items.every((i) => !i.watched && i.watchAgeDays === null));
    check("every item carries the key its mark would be filed under",
      noArg.items.every((i) => typeof i.key === "string" && i.key.length > 0));

    console.log("\n=== authority: refused at the server, not only in the UI ===");
    const browser = await chromium.launch();
    try {
      const viewerCtx = await browser.newContext();
      await viewerCtx.addCookies([
        { name: SESSION_COOKIE, value: createSessionToken(fx.viewer.id), domain: "localhost", path: "/" },
      ]);
      const vp = await viewerCtx.newPage();
      await vp.goto(`${BASE}/people/${fx.person.id}?edit=1`, { waitUntil: "domcontentloaded" });
      await vp.waitForSelector("h1");
      check("a VIEW-only manager is offered no mark button",
        (await vp.locator('button:has-text("סמן במעקב")').count()) === 0);
      check("nor a way to clear one",
        (await vp.locator('button:has-text("הסר מעקב")').count()) === 0);

      // the request an attacker would forge: the editor's own POST, replayed
      // with the viewer's cookie
      const editorCtx = await browser.newContext();
      await editorCtx.addCookies([
        { name: SESSION_COOKIE, value: createSessionToken(fx.editor.id), domain: "localhost", path: "/" },
      ]);
      const ep = await editorCtx.newPage();
      let captured: { url: string; headers: Record<string, string>; body: string } | null = null;
      ep.on("request", (r) => {
        if (r.method() === "POST" && !captured && r.postData()?.includes("itemId")) {
          captured = { url: r.url(), headers: r.headers(), body: r.postData() ?? "" };
        }
      });
      await ep.goto(`${BASE}/people/${clean.id}?edit=1`, { waitUntil: "domcontentloaded" });
      await ep.waitForSelector('button:has-text("סמן במעקב")');
      await ep.locator('button:has-text("סמן במעקב")').first().click();
      await ep.waitForTimeout(2500);
      check("the editor's own mark went through",
        (await prisma.watchMark.count({ where: { personId: clean.id } })) === 1,
        "the control works for someone who may use it");

      check("the POST was captured for replay", captured !== null);
      if (captured) {
        const c = captured as { url: string; headers: Record<string, string>; body: string };
        await prisma.watchMark.deleteMany({ where: { personId: clean.id } });
        const res = await viewerCtx.request.post(c.url, {
          headers: { ...c.headers, cookie: `${SESSION_COOKIE}=${createSessionToken(fx.viewer.id)}` },
          data: c.body,
        });
        const landed = await prisma.watchMark.count({ where: { personId: clean.id } });
        check("the same request, replayed with a VIEW-only cookie, writes nothing",
          landed === 0, `status ${res.status()}, ${landed} marks written`);
      }
    } finally {
      await browser.close();
    }

    console.log("\n=== the agent is told, and told the truth ===");
    const marked = computePersonGaps(await loadForGaps(fx.person.id), today, await watchContextFor(fx.person.id, today));
    check("a watched gap still carries its own level into anything that reads gaps",
      marked.items.filter((i) => i.watched).every((i) => i.level === "OVERDUE"),
      "nothing downstream can mistake an acknowledgement for a closure");
    check("and reports how long it has been known",
      marked.items.filter((i) => i.watched).every((i) => typeof i.watchAgeDays === "number"));
  } finally {
    await cleanup();
    const left =
      (await prisma.person.count({ where: { fullName: { startsWith: TAG } } })) +
      (await prisma.orgNode.count({ where: { name: { startsWith: TAG } } })) +
      (await prisma.careerPlan.count({ where: { name: { startsWith: TAG } } })) +
      (await prisma.user.count({ where: { username: { startsWith: TAG } } })) +
      (await prisma.appSetting.count({ where: { key: WATCH_EXPIRY_KEY } }));
    check("no fixtures left behind", left === 0, `${left}`);
    console.log(failures ? `\nFAILED — ${checks} ran, ${failures} failed` : `\nall ${checks} checks passed`);
    process.exitCode = failures ? 1 : 0;
    await prisma.$disconnect();
  }
}

main().catch(async (e) => {
  console.error("\nFAILED — the suite crashed:", e);
  await cleanup().catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
