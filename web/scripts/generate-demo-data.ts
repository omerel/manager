/**
 * Demo-dataset generator: adds a realistic organisation next to whatever is
 * already in the database. Nothing existing is modified or removed.
 *
 *   npm run demo:data
 *
 * Everything generated hangs off ONE center, so removing it later is a single
 * cascade delete from the hierarchy page rather than a hunt through records.
 *
 * All randomness comes from a fixed seed: two runs produce the same people, so
 * a defect found in generated data can be found again after a database reset.
 */
import { prisma } from "@/lib/prisma";
import { composeFullName } from "@/lib/person-name";
import { nextColorKey } from "@/lib/palette";
import { hashPassword } from "@/lib/password";
import { addMonths } from "@/lib/dates";
import type { FieldType } from "@/generated/prisma/client";

const DEMO_CENTER = "מרכז הדגמה";
const SEED = 20260731;
const TODAY = new Date();

/* ---------- deterministic pseudo-randomness ---------- */
// A linear congruential step. Small on purpose: the guarantee we need is
// repeatability, not statistical quality.
let state = SEED;
function rnd(): number {
  state = (state * 1664525 + 1013904223) % 4294967296;
  return state / 4294967296;
}
const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
const chance = (p: number) => rnd() < p;

/* ---------- Hebrew name pools ---------- */
const FIRST = [
  "אביב", "אדם", "איתמר", "אלון", "אמיר", "אסף", "ארז", "בן", "גיא", "דור",
  "הראל", "זיו", "חן", "טל", "יהונתן", "יואב", "ירדן", "לביא", "מתן", "ניר",
  "עומרי", "עידו", "רועי", "שחר", "תומר", "אביגיל", "אדוה", "אורית", "אלינור",
  "גלי", "דניאל", "הילה", "ורד", "יעל", "כרמל", "ליאור", "מיכל", "נטע",
  "סיון", "עדי", "רותם", "שירה", "תמר", "נועם", "אורי", "רוני",
];
const LAST = [
  "אביטל", "אלמוג", "בן-דוד", "ברקוביץ", "גולן", "דגן", "הרשקוביץ", "וייס",
  "זילברמן", "חדד", "טולדנו", "יעקובי", "כהן-צדק", "לביא", "מזרחי", "נחמיאס",
  "סגל", "עמר", "פרידמן", "צוריאל", "קפלן", "רוזנברג", "שפירא", "תדהר",
  "אזולאי", "בכר", "גרינברג", "דיין", "הלוי", "ויצמן", "זהבי", "חזן",
];
const CITIES = ["חיפה", "תל אביב", "ירושלים", "באר שבע", "רעננה", "מודיעין", "כרמיאל", "רחובות", "הרצליה", "נס ציונה", "פתח תקווה", "קרית ביאליק"];
const EDUCATION = [
  "תואר ראשון במדעי המחשב", "תואר שני במדעי המחשב", "תואר ראשון בהנדסת חשמל",
  "תואר שני בהנדסת חשמל", "תואר ראשון במתמטיקה", "תואר שני בסטטיסטיקה",
  "דוקטורט בלמידת מכונה", "תואר ראשון בפיזיקה", "הנדסאי תוכנה",
];

/* ---------- org shape: uneven on purpose, so rollups differ ---------- */
const ORG: { domain: string; sections: { name: string; teams: { name: string; size: number }[] }[] }[] = [
  {
    domain: "תחום אלגוריתמיקה",
    sections: [
      { name: "מדור ראייה", teams: [{ name: "צוות פיקסל", size: 5 }, { name: "צוות עדשה", size: 3 }] },
      { name: "מדור שפה", teams: [{ name: "צוות סמנטיקה", size: 4 }, { name: "צוות תמלול", size: 1 }] },
    ],
  },
  {
    domain: "תחום מערכות",
    sections: [
      { name: "מדור תשתיות", teams: [{ name: "צוות ליבה", size: 6 }, { name: "צוות ענן", size: 2 }] },
      { name: "מדור אינטגרציה", teams: [{ name: "צוות שילוב", size: 4 }] },
    ],
  },
  {
    domain: "תחום מחקר יישומי",
    sections: [{ name: "מדור ניסויים", teams: [{ name: "צוות שדה", size: 3 }, { name: "צוות ניתוח", size: 4 }] }],
  },
];
const TOTAL_PEOPLE = ORG.flatMap((d) => d.sections.flatMap((s) => s.teams.map((t) => t.size))).reduce((a, b) => a + b, 0);

/* ---------- card values, derived from the Admin-defined schema ---------- */
// Hard-coding today's fields would silently stop filling any field added later,
// and a half-empty card looks like one somebody forgot to finish.
function valueForField(def: { label: string; type: FieldType; options: string[] }): string {
  if (def.type === "ENUM") return def.options.length ? pick(def.options) : "";
  if (def.type === "DATE") return new Date(Date.UTC(int(2015, 2025), int(0, 11), int(1, 28))).toISOString().slice(0, 10);
  if (def.type === "NUMBER") {
    if (/תעודת זהות|ת\.?ז/.test(def.label)) return String(int(200000000, 399999999));
    if (/מספר אישי/.test(def.label)) return String(int(5000000, 9999999));
    return String(int(1, 999));
  }
  if (/עיר|מגורים/.test(def.label)) return pick(CITIES);
  if (/השכלה|תואר/.test(def.label)) return pick(EDUCATION);
  if (/נייד|טלפון/.test(def.label)) return `05${int(0, 8)}-${String(int(1000000, 9999999)).slice(0, 7)}`;
  return pick(["—", "לא הוזן", "בבדיקה"]);
}

/* ---------- the three plan templates, deliberately different in shape ---------- */
type PlanSpec = {
  name: string;
  points: { label: string; offsetMonths: number }[];
  metrics: { name: string; unit: string; checkpoints: { offsetMonths: number; target: number }[] }[];
  recurring: { label: string; intervalMonths: number; stopOffsetMonths: number }[];
};

const PLANS: PlanSpec[] = [
  {
    // milestone-led: card-heavy diagram, point-progress gaps
    name: "מסלול קליטה מואץ",
    points: [
      { label: "סיום חפיפה", offsetMonths: 2 },
      { label: "משימה ראשונה עצמאית", offsetMonths: 4 },
      { label: "הצגה בפורום מקצועי", offsetMonths: 8 },
      { label: "אישור מומחיות", offsetMonths: 12 },
      { label: "הובלת משימה", offsetMonths: 18 },
      { label: "סיום המסלול", offsetMonths: 24 },
    ],
    metrics: [{ name: "שעות הכשרה", unit: "שעות", checkpoints: [{ offsetMonths: 6, target: 80 }, { offsetMonths: 18, target: 200 }] }],
    recurring: [{ label: "שיחת חניכה", intervalMonths: 6, stopOffsetMonths: 24 }],
  },
  {
    // metric-led: exercises the value axis and the palette cycling
    name: "מסלול מומחה טכנולוגי",
    points: [
      { label: "בחירת תחום התמחות", offsetMonths: 6 },
      { label: "פרסום ראשון", offsetMonths: 24 },
    ],
    metrics: [
      { name: "שעות גמול השתלמות", unit: "שעות", checkpoints: [{ offsetMonths: 12, target: 120 }, { offsetMonths: 24, target: 300 }, { offsetMonths: 48, target: 600 }] },
      { name: "מענקי מחקר", unit: "ש״ח", checkpoints: [{ offsetMonths: 18, target: 5000 }, { offsetMonths: 36, target: 15000 }] },
      { name: "קורסים מתקדמים", unit: "קורסים", checkpoints: [{ offsetMonths: 12, target: 2 }, { offsetMonths: 36, target: 5 }] },
      { name: "הרצאות פנימיות", unit: "הרצאות", checkpoints: [{ offsetMonths: 24, target: 3 }, { offsetMonths: 48, target: 8 }] },
    ],
    recurring: [{ label: "הערכה מקצועית", intervalMonths: 12, stopOffsetMonths: 48 }],
  },
  {
    // evaluation-led: occurrence unrolling, fanned markers, long horizon
    name: "מסלול פיקוד וניהול",
    points: [
      { label: "קורס ניהול בסיסי", offsetMonths: 9 },
      { label: "ניהול צוות ראשון", offsetMonths: 24 },
      { label: "קורס פיקוד בכיר", offsetMonths: 48 },
      { label: "סיום המסלול", offsetMonths: 72 },
    ],
    metrics: [
      { name: "שעות ניהול", unit: "שעות", checkpoints: [{ offsetMonths: 24, target: 150 }, { offsetMonths: 60, target: 500 }] },
      // deliberately shared with the technologist track: grant hours accrue
      // whichever path a person is on, so a transfer has something to carry
      { name: "שעות גמול השתלמות", unit: "שעות", checkpoints: [{ offsetMonths: 24, target: 200 }, { offsetMonths: 60, target: 600 }] },
    ],
    recurring: [
      { label: "חוות דעת תקופתית", intervalMonths: 6, stopOffsetMonths: 72 },
      { label: "שיחת משוב מפקד", intervalMonths: 9, stopOffsetMonths: 72 },
      { label: "סקר 360", intervalMonths: 24, stopOffsetMonths: 72 },
    ],
  },
];

async function main() {
  /* ---- guard: additive generation is not idempotent, so refuse rather than duplicate ---- */
  const existing = await prisma.orgNode.findFirst({ where: { name: DEMO_CENTER } });
  if (existing) {
    console.error(
      `נתוני ההדגמה כבר קיימים ("${DEMO_CENTER}"). לא נכתב דבר.\n` +
        `להסרה: עמוד היררכיה ← מחיקת המרכז (מוחק את כל התת-עץ), ואז הרצה מחדש.`,
    );
    process.exit(1);
  }

  /* ---- 1. plan templates ---- */
  const templates = [];
  for (const spec of PLANS) {
    const tpl = await prisma.careerPlan.create({
      data: {
        name: spec.name,
        pointEvents: { create: spec.points },
        cumulativeMetrics: {
          create: spec.metrics.map((m, i) => ({
            name: m.name,
            unit: m.unit,
            color: nextColorKey(i),
            checkpoints: { create: m.checkpoints },
          })),
        },
        recurringEvents: {
          create: spec.recurring.map((r, i) => ({
            label: r.label,
            intervalMonths: r.intervalMonths,
            startOffsetMonths: r.intervalMonths, // first occurrence one interval in, as before the column
            // the first recurring event of each plan is drawn as cards, so the
            // dev registry exercises both display modes, not only the default
            display: i === 0 ? ("CARD" as const) : ("MARKER" as const),
            stopMode: "UNTIL_OFFSET" as const,
            stopOffsetMonths: r.stopOffsetMonths,
            color: nextColorKey(i),
          })),
        },
      },
      include: { pointEvents: true, cumulativeMetrics: { include: { checkpoints: true } }, recurringEvents: true },
    });
    templates.push(tpl);
  }
  // people may also be put on a plan that already existed, so the demo mixes with real data
  const priorTemplates = await prisma.careerPlan.findMany({
    where: { isTemplate: true, id: { notIn: templates.map((t) => t.id) } },
    include: { pointEvents: true, cumulativeMetrics: { include: { checkpoints: true } }, recurringEvents: true },
  });
  const allTemplates = [...templates, ...priorTemplates];
  console.log(`תכניות שנוצרו: ${templates.map((t) => t.name).join(", ")}`);

  /* ---- 2. organisation ---- */
  const center = await prisma.orgNode.create({ data: { name: DEMO_CENTER, kind: "CENTER" } });
  const teams: { id: string; name: string; size: number }[] = [];
  const domainIds: Record<string, string> = {};
  const sectionIds: Record<string, string> = {};
  for (const d of ORG) {
    const domain = await prisma.orgNode.create({ data: { name: d.domain, kind: "DOMAIN", parentId: center.id } });
    domainIds[d.domain] = domain.id;
    for (const s of d.sections) {
      const section = await prisma.orgNode.create({ data: { name: s.name, kind: "SECTION", parentId: domain.id } });
      sectionIds[s.name] = section.id;
      for (const t of s.teams) {
        const team = await prisma.orgNode.create({ data: { name: t.name, kind: "TEAM", parentId: section.id } });
        teams.push({ id: team.id, name: t.name, size: t.size });
      }
    }
  }
  console.log(`מסגרות: מרכז + ${ORG.length} תחומים + ${Object.keys(sectionIds).length} מדורים + ${teams.length} צוותים`);

  /* ---- 3. people ---- */
  // The gap spread is arranged, not left to chance: a profile is chosen first,
  // then the recruitment date and the recorded progress are derived from it.
  // Purely random progress produces a wall of red, because a person's status is
  // the worst of all their items — one missed milestone is enough.
  type Profile = "exemplary" | "approaching" | "slipping" | "neglected" | "unplanned";
  const profileFor = (): Profile => {
    const r = rnd();
    if (r < 0.3) return "exemplary";   // everything past due is done
    if (r < 0.45) return "approaching"; // done, with an item falling due within the month
    if (r < 0.7) return "slipping";    // some items missed
    if (r < 0.85) return "neglected";  // nothing recorded
    return "unplanned";                // no plan at all
  };

  const defs = await prisma.personFieldDef.findMany({ orderBy: { order: "asc" } });
  const usedNames = new Set<string>();
  const created: {
    id: string;
    fullName: string;
    recruitmentDate: Date;
    planId: string | null;
    profile: Profile;
    tpl: (typeof allTemplates)[number] | null;
  }[] = [];

  for (const team of teams) {
    for (let i = 0; i < team.size; i++) {
      let firstName = pick(FIRST);
      let lastName = pick(LAST);
      while (usedNames.has(`${firstName} ${lastName}`)) {
        firstName = pick(FIRST);
        lastName = pick(LAST);
      }
      usedNames.add(`${firstName} ${lastName}`);

      const profile = profileFor();
      const tpl = profile === "unplanned" ? null : pick(allTemplates);

      // Recruitment is spread over ~6 years so the same plan lands people at
      // different points along their timeline — except for the "approaching"
      // profile, where it is chosen so that a specific plan item falls due in
      // about two weeks. That state cannot be reached reliably by chance.
      let monthsAgo = int(1, 72);
      if (profile === "approaching" && tpl) {
        const offsets = [
          ...tpl.pointEvents.map((e) => e.offsetMonths),
          ...tpl.cumulativeMetrics.flatMap((m) => m.checkpoints.map((c) => c.offsetMonths)),
        ].filter((o) => o >= 6);
        if (offsets.length) monthsAgo = pick(offsets);
      }
      const recruitmentDate = addMonths(TODAY, -monthsAgo);
      if (profile === "approaching") recruitmentDate.setUTCDate(recruitmentDate.getUTCDate() + 18);
      const birthDate = new Date(Date.UTC(TODAY.getUTCFullYear() - int(22, 55), int(0, 11), int(1, 28)));

      // a few have left, a few are on their way out — both are states the UI must handle
      const departed = chance(0.07) && monthsAgo > 24;
      const plannedEnd = !departed && chance(0.1);
      const status = departed ? "DEPARTED" : plannedEnd ? "PLANNED_END" : "ACTIVE";
      const endOfServiceDate = departed
        ? addMonths(recruitmentDate, int(12, Math.max(13, monthsAgo - 2)))
        : plannedEnd
          ? addMonths(TODAY, int(2, 10))
          : null;

      const person = await prisma.person.create({
        data: {
          firstName,
          lastName,
          fullName: composeFullName(firstName, lastName),
          birthDate,
          recruitmentDate,
          // Most people started here; every 7th arrived later, so the dev
          // registry actually exercises a placement date that is NOT the
          // recruitment date — otherwise the anchor is untested by the data.
          placementDate: i % 7 === 3 ? addMonths(recruitmentDate, 6) : recruitmentDate,
          status,
          endOfServiceDate,
          teamId: team.id,
          fieldValues: {
            create: defs.map((d) => ({ fieldDefId: d.id, value: valueForField(d), order: d.order })),
          },
        },
      });
      created.push({ id: person.id, fullName: person.fullName, recruitmentDate, planId: null, profile, tpl });
    }
  }
  console.log(`אנשים שנוצרו: ${created.length}`);

  /* ---- 4. plan assignment: an independent copy, as the application does ---- */
  for (const p of created) {
    const tpl = p.tpl;
    if (!tpl) continue; // the unplanned slice — a state worth seeing populated
    const copy = await prisma.careerPlan.create({
      data: {
        name: tpl.name,
        isTemplate: false,
        sourceTemplateId: tpl.id,
        pointEvents: { create: tpl.pointEvents.map((e) => ({ label: e.label, offsetMonths: e.offsetMonths })) },
        recurringEvents: {
          create: tpl.recurringEvents.map((r) => ({
            label: r.label,
            intervalMonths: r.intervalMonths,
            startOffsetMonths: r.startOffsetMonths,
            stopMode: "UNTIL_OFFSET" as const,
            stopOffsetMonths: r.stopOffsetMonths ?? 72,
            color: r.color,
          })),
        },
        cumulativeMetrics: {
          create: tpl.cumulativeMetrics.map((m) => ({
            name: m.name,
            unit: m.unit,
            color: m.color,
            checkpoints: { create: m.checkpoints.map((c) => ({ offsetMonths: c.offsetMonths, target: c.target })) },
          })),
        },
      },
      include: { pointEvents: true, cumulativeMetrics: { include: { checkpoints: true } }, recurringEvents: true },
    });
    await prisma.person.update({ where: { id: p.id }, data: { assignedPlanId: copy.id } });
    p.planId = copy.id;

    const elapsed = Math.max(0, Math.round((TODAY.getTime() - p.recruitmentDate.getTime()) / (30.44 * 864e5)));

    // The assignment record. Most people were on this plan from the start, so
    // their waiver line is 0 and everything is measured; transfers below get a
    // real line and a previous assignment behind them.
    await prisma.planAssignment.create({
      data: {
        personId: p.id,
        planId: copy.id,
        templateName: tpl.name,
        assignedAt: p.recruitmentDate,
        waiverOffsetMonths: 0,
      },
    });

    /* ---- 5. progress, arranged so the dashboard is not monochrome ---- */
    // "exemplary" and "approaching" complete everything already due; the
    // difference between them is only what happens to fall due next.
    const complete = p.profile === "exemplary" || p.profile === "approaching";
    const partial = p.profile === "slipping";
    const meets = (i: number) => complete || (partial && i % 3 !== 0); // "neglected" records nothing

    for (const [i, e] of copy.pointEvents.entries()) {
      if (e.offsetMonths > elapsed) continue; // not due yet
      if (!meets(i)) continue; // left incomplete → 🔴 once past due
      await prisma.pointProgress.create({
        data: { personId: p.id, pointEventId: e.id, doneOn: addMonths(p.recruitmentDate, e.offsetMonths) },
      });
    }

    for (const [i, m] of copy.cumulativeMetrics.entries()) {
      if (p.profile === "neglected") continue; // never recorded → short of every passed target
      const passed = m.checkpoints.filter((c) => c.offsetMonths <= elapsed);
      const binding = passed.length ? passed[passed.length - 1] : m.checkpoints[0];
      if (!binding) continue;
      // clears the binding target when on track, falls short when slipping
      const value = meets(i)
        ? Math.round(binding.target * (1 + rnd() * 0.3))
        : Math.round(binding.target * (0.3 + rnd() * 0.4));
      await prisma.metricReading.create({ data: { personId: p.id, metricId: m.id, value, asOf: TODAY } });
    }

    let occurrence = 0;
    for (const r of copy.recurringEvents) {
      const cap = Math.min(r.stopOffsetMonths ?? 0, elapsed);
      for (let off = r.intervalMonths; off <= cap; off += r.intervalMonths) {
        if (!meets(occurrence++)) continue; // an unfilled past occurrence → 🔴
        await prisma.evalEntry.create({
          data: {
            personId: p.id,
            recurringEventId: r.id,
            occurrenceOffset: off,
            eventDate: addMonths(p.recruitmentDate, off), // the occurrence's own month
            title: `${r.label} · גיוס +${off} חודשים`,
            content: pick([
              "עומד/ת ביעדים, השתלבות טובה בצוות.",
              "התקדמות טובה; הומלץ להעמיק בתחום ההתמחות.",
              "ביצועים גבוהים, מוביל/ה משימות באופן עצמאי.",
              "נדרש חיזוק בתחום הכתיבה הטכנית.",
            ]),
          },
        });
      }
    }

    // a free-form entry for a few people, for the evaluations section
    if (chance(0.25)) {
      await prisma.evalEntry.create({
        data: {
          personId: p.id,
          // spread over the past year, so ordering by event date is exercised
          eventDate: addMonths(TODAY, -int(0, 11)),
          title: pick(["השתתפות בכנס", "קבלת צל״ש", "סיום קורס חיצוני", "הובלת יום עיון"]),
          content: "רשומה חופשית שנוצרה עבור נתוני ההדגמה.",
        },
      });
    }
  }
  console.log(`שויכו תכניות: ${created.filter((p) => p.planId).length} · ללא תכנית: ${created.filter((p) => !p.planId).length}`);

  /* ---- 4b. transfers: a slice of people moved plans partway through ---- */
  // Without these the transfer feature has no data to exercise it: no ended
  // assignment, no waived items, no carried value.
  const movable = created.filter((p) => p.planId && p.profile !== "unplanned").slice(0, 6);
  let transfers = 0;
  for (const p of movable) {
    if (!chance(0.6)) continue;
    const elapsed = Math.max(0, Math.round((TODAY.getTime() - p.recruitmentDate.getTime()) / (30.44 * 864e5)));
    if (elapsed < 18) continue; // needs enough history behind them to be interesting
    // prefer a target sharing a metric with the source: a transfer that can
    // carry nothing exercises only half the feature
    const others = allTemplates.filter((t) => t.id !== p.tpl!.id);
    const sourceMetrics = new Set(p.tpl!.cumulativeMetrics.map((m) => `${m.name}|${m.unit}`));
    const overlapping = others.filter((t) => t.cumulativeMetrics.some((m) => sourceMetrics.has(`${m.name}|${m.unit}`)));
    const target = pick(overlapping.length ? overlapping : others);
    if (!target) continue;

    // end the current assignment
    await prisma.planAssignment.updateMany({
      where: { personId: p.id, planId: p.planId!, endedAt: null },
      data: { endedAt: TODAY, reason: pick(["מעבר לתפקיד ניהולי", "שינוי התמחות", "מעבר בין מדורים", "בקשת העובד"]) },
    });

    // the new copy, as the application builds it
    const copy = await prisma.careerPlan.create({
      data: {
        name: target.name,
        isTemplate: false,
        sourceTemplateId: target.id,
        pointEvents: { create: target.pointEvents.map((e) => ({ label: e.label, offsetMonths: e.offsetMonths })) },
        recurringEvents: {
          create: target.recurringEvents.map((r) => ({
            label: r.label,
            intervalMonths: r.intervalMonths,
            startOffsetMonths: r.startOffsetMonths,
            stopMode: "UNTIL_OFFSET" as const,
            stopOffsetMonths: r.stopOffsetMonths ?? 72,
            color: r.color,
          })),
        },
        cumulativeMetrics: {
          create: target.cumulativeMetrics.map((m) => ({
            name: m.name,
            unit: m.unit,
            color: m.color,
            checkpoints: { create: m.checkpoints.map((c) => ({ offsetMonths: c.offsetMonths, target: c.target })) },
          })),
        },
      },
      include: { pointEvents: true, cumulativeMetrics: true },
    });
    const assignment = await prisma.planAssignment.create({
      data: {
        personId: p.id,
        planId: copy.id,
        templateName: target.name,
        assignedAt: TODAY,
        waiverOffsetMonths: elapsed, // everything before the move was never asked of them
      },
    });
    await prisma.person.update({ where: { id: p.id }, data: { assignedPlanId: copy.id } });

    // Carry every accumulated value that has a counterpart, so the next
    // checkpoint is not measured from zero. Checking only the first reading
    // would skip a match whenever the person happens to have more than one.
    const oldReadings = await prisma.metricReading.findMany({
      where: { personId: p.id, metric: { planId: p.planId! } },
      include: { metric: true },
    });
    for (const r of oldReadings) {
      const toMetric = copy.cumulativeMetrics.find((m) => m.name === r.metric.name && m.unit === r.metric.unit);
      if (!toMetric) continue;
      await prisma.metricReading.create({
        data: { personId: p.id, metricId: toMetric.id, value: r.value, asOf: r.asOf },
      });
      await prisma.planCarryOver.create({
        data: {
          assignmentId: assignment.id,
          kind: "METRIC",
          fromPlanName: p.tpl!.name,
          fromLabel: `${r.metric.name} (${r.metric.unit})`,
          toMetricId: toMetric.id,
          value: r.value,
          originalDate: r.asOf,
        },
      });
    }

    // and every completed milestone the new plan repeats
    const oldDone = await prisma.pointProgress.findMany({
      where: { personId: p.id, pointEvent: { planId: p.planId! } },
      include: { pointEvent: true },
    });
    for (const d of oldDone) {
      const toPoint = copy.pointEvents.find((e) => e.label === d.pointEvent.label);
      if (!toPoint) continue;
      await prisma.pointProgress.create({ data: { personId: p.id, pointEventId: toPoint.id, doneOn: d.doneOn } });
      await prisma.planCarryOver.create({
        data: {
          assignmentId: assignment.id,
          kind: "POINT",
          fromPlanName: p.tpl!.name,
          fromLabel: d.pointEvent.label,
          toPointEventId: toPoint.id,
          originalDate: d.doneOn,
        },
      });
    }
    transfers++;
  }
  console.log(`מעברים בין מסלולים: ${transfers}`);

  /* ---- 6. managers over parts of the tree, for judging scoped views ---- */
  const pw = hashPassword("password");
  const managers = [
    { name: "ראש תחום אלגוריתמיקה", username: "demo.algo", nodeId: domainIds["תחום אלגוריתמיקה"], level: "EDIT" as const },
    { name: "ראש מדור תשתיות", username: "demo.infra", nodeId: sectionIds["מדור תשתיות"], level: "EDIT" as const },
    { name: "צופה מרכז הדגמה", username: "demo.viewer", nodeId: center.id, level: "VIEW" as const },
  ];
  for (const m of managers) {
    const taken = await prisma.user.findFirst({ where: { username: m.username } });
    if (taken) continue;
    await prisma.user.create({
      data: {
        name: m.name,
        email: `${m.username}@example.com`,
        username: m.username,
        passwordHash: pw,
        role: "MANAGER",
        grants: { create: [{ nodeId: m.nodeId, level: m.level }] },
      },
    });
  }
  console.log(`משתמשי הדגמה: ${managers.map((m) => m.username).join(", ")} (סיסמה: password)`);

  console.log(`\nהושלם. להסרה: עמוד היררכיה ← מחיקת "${DEMO_CENTER}".`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

export { TOTAL_PEOPLE };
