/**
 * One-off: give every person missing an identity value a TEST value, so the
 * bulk import's matching can see the whole registry.
 *
 * User-approved on 2026-08-09 — the data in this system is play data. The
 * script refuses to touch a person who already has a value, so running it twice
 * changes nothing and running it on real data one day changes only the truly
 * empty.
 *
 *   npx tsx scripts/backfill-identity-values.ts
 */
import { prisma } from "@/lib/prisma";
import { normalizeIdentity } from "@/lib/identity-keys";

async function main() {
  const defs = await prisma.personFieldDef.findMany({
    where: { label: { in: ["תעודת זהות", "מספר אישי"] } },
    select: { id: true, label: true, order: true },
  });
  const people = await prisma.person.findMany({
    select: { id: true, fullName: true, fieldValues: { select: { fieldDefId: true, value: true } } },
    orderBy: { fullName: "asc" },
  });

  // existing values, so generated ones cannot collide with them or each other
  const taken = new Set<string>();
  for (const p of people) for (const v of p.fieldValues) taken.add(normalizeIdentity(v.value));

  let seq = 100_000_000; // 9 digits, clearly synthetic, ordered
  const next = () => {
    do seq += 7;
    while (taken.has(String(seq)));
    taken.add(String(seq));
    return String(seq);
  };

  let filled = 0;
  for (const def of defs) {
    for (const p of people) {
      const has = p.fieldValues.some((v) => v.fieldDefId === def.id && normalizeIdentity(v.value).length > 0);
      if (has) continue; // never touch an existing value
      const value = next();
      await prisma.personFieldValue.upsert({
        where: { personId_fieldDefId: { personId: p.id, fieldDefId: def.id } },
        create: { personId: p.id, fieldDefId: def.id, value, order: def.order },
        update: { value },
      });
      console.log(`  + ${def.label} ${value} → ${p.fullName}`);
      filled++;
    }
  }
  console.log(filled === 0 ? "nothing to fill — every person has both values" : `filled ${filled} values`);
  await prisma.$disconnect();
}

main();
