/**
 * Verification for placement-anchor-and-recurring-display (task 6.5).
 *
 * Counts shapes in the rendered SVG rather than trusting the eye: the same
 * event, flipped between the two modes, must produce cards XOR diamonds — never
 * both, never neither.
 *
 *   npx tsx --env-file=.env scripts/verify-recurring-display.ts
 */
import { prisma } from "../src/lib/prisma";
import { getPlan } from "../src/lib/plans";
import { buildPlanDiagramSvg } from "../src/lib/plan-diagram";
import { unrollRecurring } from "../src/lib/plans";

let failures = 0;
let checks = 0;
function check(label: string, ok: boolean, detail = "") {
  checks++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

/**
 * Occurrence diamonds only. The legend draws its own key swatch as a rotated
 * rect too, so matching "any rotated rect" counts a shape that is not an
 * occurrence — occurrence markers are 12x12, legend swatches 10x10.
 */
const diamonds = (svg: string) =>
  (svg.match(/<rect[^>]*width="12" height="12"[^>]*transform="rotate/g) ?? []).length;
const legendSwatches = (svg: string) =>
  (svg.match(/<rect[^>]*width="10" height="10"[^>]*transform="rotate/g) ?? []).length;
/** a card carries its title in a foreignObject text div */
const cardsTitled = (svg: string, title: string) =>
  (svg.match(new RegExp(`>${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}<`, "g")) ?? []).length;

async function main() {
  const plan = await prisma.careerPlan.findFirstOrThrow({
    where: { isTemplate: true, recurringEvents: { some: {} } },
    select: { id: true, name: true, recurringEvents: { select: { id: true, label: true, display: true } } },
  });
  const ev = plan.recurringEvents[0];
  const original = ev.display;
  const full = await getPlan(plan.id);
  const row = full!.recurringEvents.find((r) => r.id === ev.id)!;
  const occurrences = unrollRecurring(row.intervalMonths, row.stopOffsetMonths, row.startOffsetMonths).length;
  console.log(`\nplan "${plan.name}" · event "${ev.label}" · ${occurrences} occurrences`);
  check("the fixture event actually unrolls", occurrences > 1, `${occurrences}`);

  try {
    await prisma.recurringEvent.update({ where: { id: ev.id }, data: { display: "MARKER" } });
    const asMarker = buildPlanDiagramSvg((await getPlan(plan.id))!);
    const markerDiamonds = diamonds(asMarker);
    const markerCards = cardsTitled(asMarker, ev.label);

    await prisma.recurringEvent.update({ where: { id: ev.id }, data: { display: "CARD" } });
    const asCard = buildPlanDiagramSvg((await getPlan(plan.id))!);
    const cardDiamonds = diamonds(asCard);
    const cardCards = cardsTitled(asCard, ev.label);

    console.log(`  MARKER: ${markerDiamonds} occurrence diamonds, ${legendSwatches(asMarker)} legend swatches, ${markerCards} cards`);
    console.log(`  CARD  : ${cardDiamonds} occurrence diamonds, ${legendSwatches(asCard)} legend swatches, ${cardCards} cards`);

    check("MARKER draws one diamond per occurrence", markerDiamonds === occurrences, `${markerDiamonds} vs ${occurrences}`);
    check("MARKER draws no card for it", markerCards === 0);
    check("CARD draws one card per occurrence", cardCards === occurrences, `${cardCards} vs ${occurrences}`);
    check("CARD draws none of its diamonds — one representation, never both", cardDiamonds === markerDiamonds - occurrences,
      `${cardDiamonds}`);
    check("CARD drops its legend swatch too", legendSwatches(asCard) === legendSwatches(asMarker) - 1);
    check("it appears in the marker legend only when drawn as markers",
      asMarker.includes(ev.label) && !asCard.match(new RegExp(`המסומנים על הציר[\\s\\S]*?${ev.label}`)));
  } finally {
    await prisma.recurringEvent.update({ where: { id: ev.id }, data: { display: original } });
  }

  const restored = await prisma.recurringEvent.findUniqueOrThrow({ where: { id: ev.id }, select: { display: true } });
  check("restored to its original mode", restored.display === original, restored.display);

  console.log(failures === 0 ? `\nall ${checks} checks passed` : `\nFAILED — ${checks} ran, ${failures} failed`);
  await prisma.$disconnect();
  process.exit(failures ? 1 : 0);
}

main();
