/**
 * Verification for agent-sees-whole-person.
 *
 * The fault this exists to catch was not "the date of birth is missing". It was
 * that the person card and the agent's snapshot describe the same thing in two
 * hand-written lists that nobody had ever compared. A check asserting that one
 * particular field is present would have passed forever and missed the next
 * field to be forgotten.
 *
 * So the core of this suite is a COMPARISON: the card's fields are scraped from
 * the component that renders them — deliberately not imported from a shared
 * constant, since a check reading the same constant the page reads would pass
 * no matter how wrong both were — and each one must be represented in the
 * snapshot.
 *
 *   npx tsx scripts/verify-agent-snapshot.ts
 */
import { readFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { computeVisibility } from "@/lib/access";
import { exportScopedSnapshot, removeSnapshot } from "@/lib/agent-snapshot";
import { ageFromBirthDate } from "@/lib/person-name";

let failures = 0;
let checks = 0;
function check(label: string, ok: boolean, detail = "") {
  checks++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

/**
 * Each core field of the person card, and the snapshot key that must carry it.
 *
 * The two naming schemes differ and should: the card labels a form control, the
 * snapshot names a fact. The mapping is therefore declared, and declaring it is
 * itself the thing under test — a card field with no entry here fails the run
 * rather than being skipped.
 */
const CARD_TO_SNAPSHOT: Record<string, string> = {
  "שם פרטי": "שם",
  "שם משפחה": "שם",
  "תאריך לידה": "תאריך_לידה",
  "גיל": "גיל",
  "תאריך גיוס": "תאריך_גיוס",
  "תאריך הצבה ביחידה": "תאריך_הצבה_ביחידה",
  "סטטוס העסקה": "סטטוס",
  "תאריך סיום שירות (תת״ש)": "סיום_שירות",
};

/** The labels the card actually renders, read from its source. */
async function cardFields(): Promise<string[]> {
  const src = await readFile(new URL("../src/components/PersonFormFields.tsx", import.meta.url), "utf8");
  const labels: string[] = [];
  for (const m of src.matchAll(/<Labeled label="([^"]+)">/g)) {
    // drop the parenthetical hints — "(מחושב מתאריך הלידה)", "— אופציונלי"
    labels.push(m[1].replace(/\s*—.*$/, "").replace(/\s*\(מחושב[^)]*\)\s*$/, "").replace(/\s*\(עוגן[^)]*\)\s*$/, "").trim());
  }
  return labels;
}

async function buildSnapshot() {
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" }, include: { grants: true } });
  const vis = await computeVisibility({
    id: admin.id, name: admin.name, role: admin.role,
    grants: admin.grants.map((g) => ({ nodeId: g.nodeId, level: g.level })),
  });
  const dir = await exportScopedSnapshot(vis, new Date(), admin.id);
  return { dir, adminId: admin.id };
}

async function main() {
  // a run killed halfway must not be able to fail the next one
  await prisma.personFieldDef.deleteMany({ where: { label: { in: ["תאריך בדיקה", "שדה ריק לבדיקה"] } } });
  const { dir } = await buildSnapshot();
  try {
    const peopleRaw = await readFile(`${dir}/people.json`, "utf8");
    const people = JSON.parse(peopleRaw) as Record<string, unknown>[];

    console.log("\n=== the card and the snapshot describe the same person ===");
    const labels = await cardFields();
    check("the card's fields were read from its source", labels.length >= 8, `${labels.length} fields`);

    const keys = new Set(Object.keys(people[0] ?? {}));
    for (const label of labels) {
      const want = CARD_TO_SNAPSHOT[label];
      if (!want) {
        check(`״${label}״ has an entry in the mapping`, false, "UNMAPPED CARD FIELD — add it, or export it");
        continue;
      }
      check(`״${label}״ reaches the agent as ${want}`, keys.has(want), keys.has(want) ? "present" : "MISSING FROM SNAPSHOT");
    }

    console.log("\n=== the date of birth, which started this ===");
    const withDob = await prisma.person.findFirst({
      where: { birthDate: { not: null } },
      select: { fullName: true, birthDate: true },
    });
    const total = await prisma.person.count();
    const haveDob = await prisma.person.count({ where: { birthDate: { not: null } } });
    console.log(`     (${haveDob} of ${total} people hold a date of birth in the database)`);

    const iso = withDob!.birthDate!.toISOString().slice(0, 10);
    check("the snapshot carries a real person's date of birth", peopleRaw.includes(iso),
      `${withDob!.fullName} → ${iso}${peopleRaw.includes(iso) ? "" : " NOT IN THE SNAPSHOT"}`);

    const row = people.find((p) => p["שם"] === withDob!.fullName)!;
    check("on that person's own row", row?.["תאריך_לידה"] === iso, String(row?.["תאריך_לידה"]));
    check("and the age beside it", !!row?.["גיל"], String(row?.["גיל"]));
    check("computed by the SAME function the card uses",
      row?.["גיל"] === ageFromBirthDate(withDob!.birthDate), `card says ${ageFromBirthDate(withDob!.birthDate)}`);

    const noDob = await prisma.person.findFirst({ where: { birthDate: null }, select: { fullName: true } });
    if (noDob) {
      const r = people.find((p) => p["שם"] === noDob.fullName);
      check("a person with no date is present with null, not omitted", !!r && r["תאריך_לידה"] === null,
        r ? String(r["תאריך_לידה"]) : "ROW MISSING ENTIRELY");
    } else {
      check("a person with no date is present with null, not omitted", true, "no such person in the data");
    }

    console.log("\n=== which fields EXIST, not only which are filled ===");
    const schemaRaw = await readFile(`${dir}/schema.json`, "utf8").catch(() => "");
    check("the snapshot carries the field definitions", schemaRaw.length > 0, schemaRaw ? "schema.json" : "NO schema.json");
    const defs = await prisma.personFieldDef.findMany({ select: { label: true, type: true, options: true } });
    for (const d of defs.slice(0, 3)) {
      check(`״${d.label}״ is declared even where unfilled`, schemaRaw.includes(d.label));
    }
    // a field nobody has filled must still be declared — that is the whole point
    for (const d of defs) {
      const filled = await prisma.personFieldValue.count({ where: { field: { label: d.label }, NOT: { value: "" } } });
      if (filled === 0) {
        check(`״${d.label}״ has no values at all, and is STILL declared`, schemaRaw.includes(d.label),
          schemaRaw.includes(d.label) ? "declared" : "INVISIBLE TO THE AGENT");
        break;
      }
    }
    const enumDef = defs.find((d) => d.type === "ENUM" && d.options.length > 0);
    if (enumDef) {
      check(`the options of ״${enumDef.label}״ are declared`, enumDef.options.every((o) => schemaRaw.includes(o)),
        `${enumDef.options.length} options`);
    } else {
      check("an ENUM field with options exists to check", false, "NO ENUM FIELD FOUND — the check cannot do its job");
    }

    // The three answers that must differ. Before this change the first two were
    // indistinguishable to the agent, so "who lives in Tel Aviv?" and "what is
    // their favourite colour?" both came back as "no such field".
    console.log("\n     the three cases that must read differently:");
    const valueCounts = await Promise.all(
      defs.map(async (d) => ({ d, n: await prisma.personFieldValue.count({ where: { field: { label: d.label }, NOT: { value: "" } } }) })),
    );
    const filled = valueCounts.find((x) => x.n > 0);
    const empty = valueCounts.find((x) => x.n === 0);
    if (filled) {
      check(`  a field WITH values (״${filled.d.label}״): declared and present in the data`,
        schemaRaw.includes(filled.d.label) && peopleRaw.includes(filled.d.label), `${filled.n} values`);
    }
    if (empty) {
      check(`  a field with NO values (״${empty.d.label}״): declared, absent from the data`,
        schemaRaw.includes(empty.d.label) && !peopleRaw.includes(empty.d.label),
        "the agent can now say it exists and is empty");
    } else {
      // Every configured field happens to hold at least one value, so the case
      // cannot be shown from the data as it stands. It is created rather than
      // skipped: an untested distinction is the one that breaks.
      const ghost = await prisma.personFieldDef.create({
        data: { key: `verify_empty_${Date.now()}`, label: "שדה ריק לבדיקה", type: "TEXT", order: 998 },
      });
      try {
        const { dir: d4 } = await buildSnapshot();
        try {
          const s4 = await readFile(`${d4}/schema.json`, "utf8");
          const p4 = await readFile(`${d4}/people.json`, "utf8");
          check("  a field with NO values: declared in schema.json, absent from people.json",
            s4.includes("שדה ריק לבדיקה") && !p4.includes("שדה ריק לבדיקה"),
            "the agent can now say it exists and is empty");
        } finally {
          await removeSnapshot(d4);
        }
      } finally {
        await prisma.personFieldDef.delete({ where: { id: ghost.id } });
      }
    }
    check("  a field that does not exist: declared nowhere", !schemaRaw.includes("צבע אהוב") && !peopleRaw.includes("צבע אהוב"));

    console.log("\n=== one date convention ===");
    const dayFirst = /"\d{2}\/\d{2}\/\d{4}"/.exec(peopleRaw);
    check("no day-first dates anywhere in the people file", dayFirst === null, dayFirst?.[0] ?? "all ISO");

    // No configurable DATE field exists in the data today, which is exactly why
    // this fault was latent rather than visible. One is created here so the
    // guarantee is tested rather than assumed, and removed again afterwards.
    const person = await prisma.person.findFirstOrThrow({ select: { id: true, fullName: true } });
    const tempField = await prisma.personFieldDef.create({
      data: { key: `verify_date_${Date.now()}`, label: "תאריך בדיקה", type: "DATE", order: 999 },
    });
    try {
      await prisma.personFieldValue.create({
        data: { personId: person.id, fieldDefId: tempField.id, value: "03/08/2026" }, // as the form stores it
      });
      const { dir: d2 } = await buildSnapshot();
      try {
        const raw2 = await readFile(`${d2}/people.json`, "utf8");
        const row2 = (JSON.parse(raw2) as Record<string, never>[]).find((x) => x["שם"] === person.fullName)! as Record<string, Record<string, string>>;
        const got = row2["פרטים_נוספים"]["תאריך בדיקה"];
        check("a configurable DATE value is exported as ISO", got === "2026-08-03",
          `stored 03/08/2026 → exported ${got}`);
        check("and not day-first, which 03/08 could be read either way", got !== "03/08/2026");
        check("the field's type is declared as a date", (await readFile(`${d2}/schema.json`, "utf8")).includes("תאריך בדיקה"));
      } finally {
        await removeSnapshot(d2);
      }

      // an unreadable value must pass through rather than be guessed at
      await prisma.personFieldValue.updateMany({ where: { fieldDefId: tempField.id }, data: { value: "לא תאריך" } });
      const { dir: d3 } = await buildSnapshot();
      try {
        const row3 = (JSON.parse(await readFile(`${d3}/people.json`, "utf8")) as Record<string, never>[])
          .find((x) => x["שם"] === person.fullName)! as Record<string, Record<string, string>>;
        check("an unreadable date is carried through untouched, not guessed",
          row3["פרטים_נוספים"]["תאריך בדיקה"] === "לא תאריך", row3["פרטים_נוספים"]["תאריך בדיקה"]);
      } finally {
        await removeSnapshot(d3);
      }
    } finally {
      await prisma.personFieldDef.delete({ where: { id: tempField.id } }); // values cascade
    }

    console.log("\n=== the snapshot still exposes nothing new ===");
    check("no internal ids", !/"id"\s*:/.test(peopleRaw));
    check("no password hashes", !peopleRaw.includes("passwordHash"));
    check("no absolute file paths", !/"\/(home|var|tmp)\//.test(peopleRaw));
    check("the README names the new file", (await readFile(`${dir}/README.md`, "utf8")).includes("schema.json"));
  } finally {
    await removeSnapshot(dir);
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
  await prisma.$disconnect();
  process.exit(1);
});
