/**
 * Verification for plan-status-per-occurrence.
 *
 * The drawing used to fold every occurrence of a recurring event onto the
 * event's id and take the worst, so one overdue occurrence painted the filled
 * ones and the ones years away the same red. The correct per-occurrence status
 * was computed and then thrown away.
 *
 * The centre of this suite is therefore LEAKAGE: that one occurrence's standing
 * reaches no other. The textual list beside the drawing was always right, so it
 * is used as the yardstick rather than as a second subject.
 *
 * Needs the dev server on :4321 for the rendered-card checks.
 *
 *   npx tsx scripts/verify-occurrence-status.ts
 */
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { addMonths } from "@/lib/dates";
import { buildPlanDiagramSvg, planDiagramStatusGaps, STATUS_STYLE, VECTOR_LEGEND, occurrenceKey, type VectorStatus } from "@/lib/plan-diagram";
import { getPlan } from "@/lib/plans";
import { getPersonFull, buildPersonTimeline, buildVectorStatus, buildVectorView } from "@/lib/person-view";
import { computePersonGaps } from "@/lib/gaps";

const BASE = process.env.BASE_URL ?? "http://localhost:4321";
const TAG = "occverify";

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

/** How many cards in the SVG wear a given status colour. */
const countColour = (svg: string, s: VectorStatus) =>
  svg.split(`stroke="${STATUS_STYLE[s].accent}"`).length - 1;

async function main() {
  await cleanup();
  const today = new Date();
  // 25 months in, so no occurrence lands exactly on today — an occurrence due
  // today is neither past nor comfortably future, and the point here is the
  // clean cases
  const placement = addMonths(today, -25);

  const center = await prisma.orgNode.create({ data: { name: `${TAG} מרכז`, kind: "CENTER" } });
  const domain = await prisma.orgNode.create({ data: { name: `${TAG} תחום`, kind: "DOMAIN", parentId: center.id } });
  const section = await prisma.orgNode.create({ data: { name: `${TAG} מדור`, kind: "SECTION", parentId: domain.id } });
  const team = await prisma.orgNode.create({ data: { name: `${TAG} צוות`, kind: "TEAM", parentId: section.id } });
  const ramad = await prisma.user.create({
    data: {
      name: `${TAG} רמ״ד`, email: `${TAG}r@v.invalid`, username: `${TAG}-ramad`,
      passwordHash: hashPassword("x"), role: "MANAGER",
      grants: { create: [{ nodeId: section.id, level: "EDIT" }] },
    },
  });

  // Point events at 6 and 36 bracket the plan, so the MARKER occurrences all
  // fall inside the drawn span and every one of them gets a slot.
  const copy = await prisma.careerPlan.create({
    data: {
      name: `${TAG} מסלול`, isTemplate: false,
      pointEvents: {
        create: [
          { label: `${TAG} נקודתי מוקדם`, offsetMonths: 6 },
          { label: `${TAG} נקודתי עתידי`, offsetMonths: 30 }, // same month as a future occurrence
          { label: `${TAG} נקודתי אחרון`, offsetMonths: 36 },
        ],
      },
      recurringEvents: {
        create: [
          {
            label: `${TAG} מחזורי ככרטיס`, intervalMonths: 6, startOffsetMonths: 6,
            stopMode: "UNTIL_OFFSET", stopOffsetMonths: 36, display: "CARD",
          },
          {
            label: `${TAG} מחזורי כסמן`, intervalMonths: 6, startOffsetMonths: 6,
            stopMode: "UNTIL_OFFSET", stopOffsetMonths: 36, display: "MARKER",
          },
        ],
      },
    },
    include: { pointEvents: true, recurringEvents: true },
  });
  const asCard = copy.recurringEvents.find((r) => r.display === "CARD")!;
  const asMarker = copy.recurringEvents.find((r) => r.display === "MARKER")!;
  const futurePoint = copy.pointEvents.find((e) => e.label.includes("עתידי"))!;

  const person = await prisma.person.create({
    data: {
      firstName: TAG, lastName: "נבדק", fullName: `${TAG} נבדק`,
      recruitmentDate: placement, placementDate: placement, teamId: team.id, assignedPlanId: copy.id,
    },
  });
  await prisma.planAssignment.create({
    data: { personId: person.id, planId: copy.id, templateName: copy.name, assignedAt: placement, waiverOffsetMonths: 0 },
  });

  /**
   * A SECOND person, whose service ends in the middle of the schedule.
   *
   * This is the case that was missing, and its absence is why the fault below
   * survived: with no end-of-service date, `unrollRecurring` (what the diagram
   * draws) and `unrollForPerson` (what the status is computed for) return the
   * identical list, and no disagreement between them can show. The convenient
   * case was the only one tested.
   *
   * Their plan runs to month 36; they leave at month 18. Occurrences at 24, 30
   * and 36 will never be required of them.
   */
  const leaverPlan = await prisma.careerPlan.create({
    data: {
      name: `${TAG} מסלול עוזב`, isTemplate: false,
      pointEvents: { create: [{ label: `${TAG} נקודתי עוזב`, offsetMonths: 6 }] },
      recurringEvents: {
        create: [
          { label: `${TAG} מחזורי עוזב`, intervalMonths: 6, startOffsetMonths: 6, stopMode: "UNTIL_OFFSET", stopOffsetMonths: 36, display: "CARD" },
          { label: `${TAG} סמן עוזב`, intervalMonths: 6, startOffsetMonths: 6, stopMode: "UNTIL_OFFSET", stopOffsetMonths: 36, display: "MARKER" },
        ],
      },
    },
  });
  const leaver = await prisma.person.create({
    data: {
      firstName: TAG, lastName: "עוזב", fullName: `${TAG} עוזב`,
      recruitmentDate: placement, placementDate: placement, teamId: team.id, assignedPlanId: leaverPlan.id,
      endOfServiceDate: addMonths(placement, 18),
    },
  });
  await prisma.planAssignment.create({
    data: { personId: leaver.id, planId: leaverPlan.id, templateName: leaverPlan.name, assignedAt: placement, waiverOffsetMonths: 0 },
  });

  /* Occurrences at 6 12 18 24 30 36, with today at month 25:
   *    6, 12  filled, in the past        → MET
   *   18, 24  unfilled, in the past      → OVERDUE
   *       30  unfilled, ahead            → NOT_DUE
   *       36  filled EARLY, ahead        → MET, never NOT_DUE
   */
  const fill = (eventId: string, off: number) =>
    prisma.evalEntry.create({
      data: {
        personId: person.id, kind: "INTERVIEW", title: `${TAG} מילוי ${off}`,
        eventDate: addMonths(placement, off), recurringEventId: eventId, occurrenceOffset: off,
      },
    });
  for (const r of [asCard, asMarker]) for (const off of [6, 12, 36]) await fill(r.id, off);

  const MET_OFFSETS = [6, 12, 36];
  const OVERDUE_OFFSETS = [18, 24];
  const NOT_DUE_OFFSETS = [30];

  try {
    const full = (await getPersonFull(person.id))!;
    const timeline = buildPersonTimeline(full);
    const status = buildVectorStatus(timeline, full.placementDate, today);
    const svg = buildPlanDiagramSvg((await getPlan(copy.id))!, status);

    console.log("=== each occurrence carries its own standing ===");
    for (const off of MET_OFFSETS) {
      check(`month ${off} — filled, reads MET`,
        status.get(occurrenceKey(asCard.id, off)) === "MET", String(status.get(occurrenceKey(asCard.id, off))));
    }
    for (const off of OVERDUE_OFFSETS) {
      check(`month ${off} — past and unfilled, reads OVERDUE`,
        status.get(occurrenceKey(asCard.id, off)) === "OVERDUE", String(status.get(occurrenceKey(asCard.id, off))));
    }
    for (const off of NOT_DUE_OFFSETS) {
      check(`month ${off} — ahead and unfilled, reads NOT_DUE`,
        status.get(occurrenceKey(asCard.id, off)) === "NOT_DUE", String(status.get(occurrenceKey(asCard.id, off))));
    }

    console.log("\n=== nothing leaks between occurrences ===");
    check("the event's bare id is NOT a key any more — the fold is gone",
      status.get(asCard.id) === undefined, String(status.get(asCard.id)));
    const distinct = new Set([6, 12, 18, 24, 30, 36].map((o) => status.get(occurrenceKey(asCard.id, o))));
    check("one event yields three different standings, not one",
      distinct.size === 3, [...distinct].join(" / "));
    // Derived, never a hand-counted constant: only the CARD-mode event draws
    // cards, and the point events are drawn alongside them, so what the drawing
    // must contain is "one overdue group per drawn item that IS overdue" — a
    // number the status map already knows.
    const drawnOverdue =
      timeline.points.filter((p) => status.get(p.id) === "OVERDUE").length +
      timeline.recurrences.filter(
        (r) => r.recurringEventId === asCard.id && status.get(occurrenceKey(r.recurringEventId, r.offsetMonths)) === "OVERDUE",
      ).length;
    check("exactly the overdue items are classed overdue — no more, no fewer",
      (svg.split('class="vs-overdue"').length - 1) === drawnOverdue,
      `${svg.split('class="vs-overdue"').length - 1} groups, ${drawnOverdue} overdue items`);
    check("...and that is 3: one point event and two occurrences, not six",
      drawnOverdue === 3, String(drawnOverdue));
    check("the drawing carries all three standings at once",
      countColour(svg, "OVERDUE") > 0 && countColour(svg, "MET") > 0 && countColour(svg, "NOT_DUE") > 0,
      `overdue ${countColour(svg, "OVERDUE")} · met ${countColour(svg, "MET")} · not-due ${countColour(svg, "NOT_DUE")}`);

    console.log("\n=== filled early is met, not pending ===");
    check("month 36 was filled before its date and reads MET",
      status.get(occurrenceKey(asCard.id, 36)) === "MET");
    check("...and is not drawn in the neutral colour",
      status.get(occurrenceKey(asCard.id, 36)) !== "NOT_DUE");

    console.log("\n=== the two display modes agree ===");
    for (const off of [6, 18, 30, 36]) {
      check(`month ${off}: card mode and marker mode say the same`,
        status.get(occurrenceKey(asCard.id, off)) === status.get(occurrenceKey(asMarker.id, off)),
        `${status.get(occurrenceKey(asCard.id, off))} vs ${status.get(occurrenceKey(asMarker.id, off))}`);
    }
    check("the marker diamonds are painted per occurrence, in more than one colour",
      new Set(
        [...svg.matchAll(/<rect [^>]*transform="rotate\(45 [^)]*\)" fill="(#[0-9a-f]{6})"/g)].map((m) => m[1]),
      ).size > 1);

    console.log("\n=== a future point event and a future occurrence agree ===");
    check("the future point event reads NOT_DUE",
      status.get(futurePoint.id) === "NOT_DUE", String(status.get(futurePoint.id)));
    check("...the same as the future occurrence in that very month",
      status.get(futurePoint.id) === status.get(occurrenceKey(asCard.id, 30)));

    console.log("\n=== the neutral colour reads as neutral ===");
    check("NOT_DUE is in the legend, labelled «טרם הגיע»",
      VECTOR_LEGEND.some((l) => l.status === "NOT_DUE" && l.label === "טרם הגיע"));
    check("its accent is distinct from white and from the met green",
      STATUS_STYLE.NOT_DUE.accent !== "#ffffff" && STATUS_STYLE.NOT_DUE.accent !== STATUS_STYLE.MET.accent);
    check("...and distinct from waived, which means something else entirely",
      STATUS_STYLE.NOT_DUE.accent !== STATUS_STYLE.WAIVED.accent);
    check("a not-due card does not pulse", !svg.includes('class="vs-not-due"'));
    // a ring is emitted for overdue and approaching alone; there is no
    // approaching item here, so the rings must match the overdue items exactly
    check("a ring for every overdue item and for nothing else",
      (svg.split('class="vs-ring"').length - 1) === drawnOverdue,
      `${svg.split('class="vs-ring"').length - 1} rings, ${drawnOverdue} overdue`);
    check("the not-due cards are unclassed, so they neither pulse nor dim",
      (svg.split('class=""').length - 1) >= NOT_DUE_OFFSETS.length);

    console.log("\n=== the drawing and the list agree ===");
    // the list's own rule, lifted verbatim from EvaluationsSection
    const listOverdue = timeline.recurrences.filter(
      (s) => !s.filledByEntryId && !s.waived && s.dueDate.getTime() < today.getTime(),
    );
    const drawnOverdueSlots = timeline.recurrences.filter(
      (s) => status.get(occurrenceKey(s.recurringEventId, s.offsetMonths)) === "OVERDUE",
    );
    check("the same occurrences, not merely the same count",
      listOverdue.length === drawnOverdueSlots.length &&
        listOverdue.every((l) => drawnOverdueSlots.some((d) => d.recurringEventId === l.recurringEventId && d.offsetMonths === l.offsetMonths)),
      `list ${listOverdue.length}, drawing ${drawnOverdueSlots.length}`);
    check("and that is 4 — two occurrences on each of the two events",
      listOverdue.length === 4, String(listOverdue.length));

    console.log("\n=== the drawing covers the person's path, and only it ===");
    {
      const lFull = (await getPersonFull(leaver.id))!;
      const lTimeline = buildPersonTimeline(lFull);
      const lPlan = (await getPlan(leaverPlan.id))!;
      // exactly how the card, /me and the PDF build it — status and occurrences
      // from one timeline, so the suite cannot pass a pairing the app never does
      const view = buildVectorView(lTimeline, lFull.placementDate, today);
      const lSvg = buildPlanDiagramSvg(lPlan, view.status, view.occurrences);

      // Reported by the RENDER, not recomputed beside it. A parallel "what gets
      // drawn" calculation is the very shape of this bug — two lists, never
      // compared — so the check asks the drawing what it actually painted.
      const gaps = planDiagramStatusGaps(lPlan, view.status, view.occurrences);
      check("every item the drawing paints carries a status",
        gaps.length === 0, gaps.length ? `${gaps.length} WITHOUT: ${gaps.slice(0, 6).join(", ")}` : "all statused");

      const drawnCount = [...view.occurrences.values()].reduce((n, l) => n + l.length, 0);
      check("the drawing holds exactly the person's own occurrences",
        drawnCount === lTimeline.recurrences.length,
        `drawn ${drawnCount} · the person owes ${lTimeline.recurrences.length}`);
      check("...and none of them falls past the end of service",
        [...view.occurrences.values()].every((l) => l.every((o) => o <= 18)),
        `months drawn: ${[...new Set([...view.occurrences.values()].flat())].sort((a, b) => a - b).join(", ")}`);

      // the visible symptom, measured on the drawing itself
      const paletteDiscs = [...lSvg.matchAll(/<circle cx="[\d.]+" cy="[\d.]+" r="16" fill="(#[0-9a-f]{6})"/g)]
        .map((m) => m[1])
        .filter((hex) => !Object.values(STATUS_STYLE).some((s) => s.accent === hex));
      check("no icon disc is painted in a palette colour",
        paletteDiscs.length === 0, paletteDiscs.length ? `${paletteDiscs.length} palette discs: ${[...new Set(paletteDiscs)].join(", ")}` : "all status colours");
    }

    console.log("\n=== the gap engine is untouched ===");
    const gaps = computePersonGaps(full, today);
    check("the person is in gap", gaps.status === "OVERDUE");
    const recItems = gaps.items.filter((i) => i.kind === "recurring");
    check("still ONE item per recurring event, not one per occurrence",
      recItems.length === 2, `${recItems.length} items`);
    check("...and it names how many occurrences are outstanding",
      recItems.every((i) => i.detail.includes("2 מופעים")), recItems.map((i) => i.detail).join(" | "));

    console.log("\n=== the rendered card ===");
    const cookie = `${SESSION_COOKIE}=${createSessionToken(ramad.id)}`;
    const html = (await (await fetch(`${BASE}/people/${person.id}`, { headers: { cookie } })).text()).replaceAll("<!-- -->", "");
    check("the card renders", html.includes(`${TAG} נבדק`));
    check("the legend on the card names the neutral state", html.includes("טרם הגיע"));
    check("the neutral colour reaches the drawn card", html.includes(STATUS_STYLE.NOT_DUE.accent));
    check("the drawing on the card is not uniformly red",
      html.includes(STATUS_STYLE.MET.accent) && html.includes(STATUS_STYLE.OVERDUE.accent) && html.includes(STATUS_STYLE.NOT_DUE.accent));

    const pdf = await fetch(`${BASE}/people/${person.id}/plan-pdf`, { headers: { cookie } });
    const buf = Buffer.from(await pdf.arrayBuffer());
    check("the PDF still builds", pdf.status === 200 && buf.subarray(0, 4).toString() === "%PDF", `HTTP ${pdf.status}, ${buf.length} bytes`);
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
