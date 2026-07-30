/**
 * One-off data migration for the usability-and-file-handling-fixes change.
 * Idempotent — safe to re-run, and a no-op on a database that is already done.
 *
 *   npx tsx --env-file=.env scripts/migrate-usability-fixes.ts
 *
 * 1. Split each person's `fullName` into `firstName` / `lastName`.
 * 2. Move any "יום הולדת" card field into the new fixed `birthDate` column and
 *    delete that field definition (age is derived from birthDate, so a
 *    free-text birthday field would be a second source of truth).
 * 3. Give plan metrics and recurring events a stable soft-palette colour.
 */
import { prisma } from "@/lib/prisma";
import { nextColorKey } from "@/lib/palette";
import { splitFullName } from "@/lib/person-name";

/** Accepts dd/mm/yyyy, dd.mm.yyyy, dd-mm-yyyy and ISO yyyy-mm-dd. */
function parseBirthday(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (iso) return new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
  const dmy = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/.exec(s);
  if (dmy) {
    const year = +dmy[3] < 100 ? 1900 + +dmy[3] : +dmy[3];
    return new Date(Date.UTC(year, +dmy[2] - 1, +dmy[1]));
  }
  const loose = new Date(s);
  return Number.isNaN(loose.getTime()) ? null : loose;
}

async function splitNames(): Promise<number> {
  const people = await prisma.person.findMany({ select: { id: true, fullName: true, firstName: true, lastName: true } });
  let n = 0;
  for (const p of people) {
    if (p.firstName || p.lastName) continue;
    const { firstName, lastName } = splitFullName(p.fullName);
    await prisma.person.update({ where: { id: p.id }, data: { firstName, lastName } });
    n++;
  }
  return n;
}

async function moveBirthdayField(): Promise<{ moved: number; unparsed: string[]; removedField: boolean }> {
  const defs = await prisma.personFieldDef.findMany({ select: { id: true, label: true } });
  const def = defs.find((d) => /יום\s*הולדת|birth\s*date|תאריך\s*לידה/i.test(d.label));
  if (!def) return { moved: 0, unparsed: [], removedField: false };

  const values = await prisma.personFieldValue.findMany({
    where: { fieldDefId: def.id },
    select: { personId: true, value: true },
  });

  let moved = 0;
  const unparsed: string[] = [];
  for (const v of values) {
    const date = parseBirthday(v.value);
    if (!date) {
      unparsed.push(`${v.personId}: "${v.value}"`);
      continue;
    }
    const person = await prisma.person.findUnique({ where: { id: v.personId }, select: { birthDate: true } });
    if (person?.birthDate) continue; // already set — leave it
    await prisma.person.update({ where: { id: v.personId }, data: { birthDate: date } });
    moved++;
  }

  // values cascade away with the definition
  await prisma.personFieldDef.delete({ where: { id: def.id } });
  return { moved, unparsed, removedField: true };
}

async function backfillColors(): Promise<{ metrics: number; recurring: number }> {
  const plans = await prisma.careerPlan.findMany({
    select: {
      cumulativeMetrics: { select: { id: true, color: true }, orderBy: { name: "asc" } },
      recurringEvents: { select: { id: true, color: true }, orderBy: { intervalMonths: "asc" } },
    },
  });
  let metrics = 0;
  let recurring = 0;
  for (const plan of plans) {
    for (const [i, m] of plan.cumulativeMetrics.entries()) {
      if (m.color) continue;
      await prisma.cumulativeMetric.update({ where: { id: m.id }, data: { color: nextColorKey(i) } });
      metrics++;
    }
    for (const [i, r] of plan.recurringEvents.entries()) {
      if (r.color) continue;
      await prisma.recurringEvent.update({ where: { id: r.id }, data: { color: nextColorKey(i) } });
      recurring++;
    }
  }
  return { metrics, recurring };
}

async function main() {
  const names = await splitNames();
  console.log(`names split: ${names} people`);

  const bday = await moveBirthdayField();
  if (bday.removedField) {
    console.log(`birthday field moved into birthDate: ${bday.moved} people; field definition deleted`);
    if (bday.unparsed.length) {
      console.log(`  could not parse (left empty, fill manually):\n  ${bday.unparsed.join("\n  ")}`);
    }
  } else {
    console.log("no birthday card field found — nothing to move");
  }

  const colors = await backfillColors();
  console.log(`colours: ${colors.metrics} metrics, ${colors.recurring} recurring events`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
