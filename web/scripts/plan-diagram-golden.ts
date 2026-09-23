/**
 * The status-less career diagram, captured as a golden file.
 *
 * The plan page and its PDF render through `buildPlanDiagramSvg` with NO status
 * map, and must keep rendering byte-for-byte what they render today. Work on
 * the person-card colouring runs through the very same function, one optional
 * argument away, so a change meant for the card can reach the plan page without
 * anyone noticing. Four spot checks ("no <style>", "no vs-* classes") would not
 * have noticed: they answer "did the status machinery leak?" and not "is the
 * drawing the same drawing?".
 *
 * The fixture uses FIXED ids and covers every kind of item the diagram draws,
 * including a recurring event in each of its two display modes — the drawing is
 * a pure function of the plan, so the same plan must give the same bytes.
 *
 *   npx tsx scripts/plan-diagram-golden.ts --write    # re-record (review the diff!)
 *   npx tsx scripts/plan-diagram-golden.ts            # compare, exit 1 on drift
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { prisma } from "@/lib/prisma";
import { getPlan } from "@/lib/plans";
import { buildPlanDiagramSvg } from "@/lib/plan-diagram";

export const GOLDEN_PATH = join(process.cwd(), "scripts/fixtures/plan-diagram-plain.svg");

const ID = (s: string) => `goldenfixture-${s}`;
const PLAN_ID = ID("plan");

/** Build the fixture, render it status-less, tear it down. */
export async function renderGolden(): Promise<string> {
  await prisma.careerPlan.deleteMany({ where: { id: PLAN_ID } });
  await prisma.careerPlan.create({
    data: {
      id: PLAN_ID,
      name: "golden fixture · תכנית ייחוס",
      isTemplate: true,
      pointEvents: {
        create: [
          { id: ID("pt-1"), label: "אירוע נקודתי ראשון", offsetMonths: 6 },
          { id: ID("pt-2"), label: "אירוע נקודתי שני", offsetMonths: 24 },
        ],
      },
      cumulativeMetrics: {
        create: [
          {
            id: ID("metric"),
            name: "מדד מצטבר",
            unit: "שעות",
            color: "sky",
            checkpoints: {
              create: [
                { id: ID("cp-1"), offsetMonths: 12, target: 40 },
                { id: ID("cp-2"), offsetMonths: 30, target: 100 },
              ],
            },
          },
        ],
      },
      recurringEvents: {
        create: [
          {
            id: ID("rec-marker"), label: "מחזורי כסמן", intervalMonths: 6,
            startOffsetMonths: 6, stopMode: "UNTIL_OFFSET", stopOffsetMonths: 30,
            display: "MARKER", color: "amber",
          },
          {
            id: ID("rec-card"), label: "מחזורי ככרטיס", intervalMonths: 12,
            startOffsetMonths: 12, stopMode: "UNTIL_OFFSET", stopOffsetMonths: 24,
            display: "CARD", color: "rose",
          },
        ],
      },
    },
  });
  try {
    return buildPlanDiagramSvg((await getPlan(PLAN_ID))!);
  } finally {
    await prisma.careerPlan.delete({ where: { id: PLAN_ID } }).catch(() => {});
  }
}

async function main() {
  const svg = await renderGolden();
  const write = process.argv.includes("--write");

  if (write || !existsSync(GOLDEN_PATH)) {
    mkdirSync(dirname(GOLDEN_PATH), { recursive: true });
    writeFileSync(GOLDEN_PATH, svg, "utf8");
    console.log(`${existsSync(GOLDEN_PATH) && !write ? "created" : "recorded"} ${GOLDEN_PATH} (${svg.length} bytes)`);
  } else {
    const golden = readFileSync(GOLDEN_PATH, "utf8");
    if (svg === golden) {
      console.log(`identical — ${svg.length} bytes`);
    } else {
      console.error(`DRIFTED — golden ${golden.length} bytes, now ${svg.length} bytes`);
      // first differing line, so the diff is actionable rather than "it changed"
      const a = golden.split("\n"), b = svg.split("\n");
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if (a[i] !== b[i]) {
          console.error(`first difference at line ${i + 1}:`);
          console.error(`  golden: ${(a[i] ?? "<missing>").slice(0, 200)}`);
          console.error(`  now:    ${(b[i] ?? "<missing>").slice(0, 200)}`);
          break;
        }
      }
      process.exitCode = 1;
    }
  }
  await prisma.$disconnect();
}

if (process.argv[1]?.includes("plan-diagram-golden")) {
  main().catch(async (e) => {
    console.error("FAILED:", e);
    await prisma.careerPlan.deleteMany({ where: { id: PLAN_ID } }).catch(() => {});
    await prisma.$disconnect();
    process.exit(1);
  });
}
