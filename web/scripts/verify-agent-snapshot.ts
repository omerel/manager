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
import { readLabeledFields } from "./form-labels";
import { prisma } from "@/lib/prisma";
import { computeVisibility } from "@/lib/access";
import { exportScopedSnapshot, removeSnapshot } from "@/lib/agent-snapshot";
import { getVisiblePeople } from "@/lib/people";
import type { Role, AccessLevel } from "@/generated/prisma/client";
import { ageFromBirthDate } from "@/lib/person-name";
import { hashPassword } from "@/lib/password";

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
  // extraction is shared (scripts/form-labels.ts); the normalisation below is
  // this suite's own — it wants the name a snapshot key maps to
  return (await readLabeledFields()).map((f) =>
    f.label.replace(/\s*\(מחושב[^)]*\)\s*$/, "").replace(/\s*\(עוגן[^)]*\)\s*$/, "").trim(),
  );
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

const TAG = "snapverify";

/**
 * THE POPULATION AXIS — the guarantee this suite did not have.
 *
 * Everything above compares FIELDS: does each column of the card reach the
 * agent. That comparison can be complete and still miss an entire class of
 * people, and it did — every unassigned person was absent from the agent's data
 * while every field check passed, because the fields were checked on people who
 * happened to be present.
 *
 * So this compares PEOPLE, and as a set equality rather than an inclusion.
 * A shortfall is the bug we found; an EXCESS — the agent holding someone the
 * user's own list does not show — is worse, being a disclosure rather than an
 * omission. The same comparison catches both for free.
 */
async function checkPopulation(label: string, user: { id: string; name: string; role: Role; grants: { nodeId: string; level: AccessLevel }[] }) {
  const vis = await computeVisibility({ id: user.id, name: user.name, role: user.role, grants: user.grants });
  const listed = new Set((await getVisiblePeople(vis)).map((p) => p.fullName));
  const dir = await exportScopedSnapshot(vis, new Date(), user.id);
  try {
    const rows = JSON.parse(await readFile(`${dir}/people.json`, "utf8")) as Record<string, unknown>[];
    const carried = new Set(rows.map((r) => String(r["שם"])));
    const missing = [...listed].filter((n) => !carried.has(n));
    const extra = [...carried].filter((n) => !listed.has(n));
    check(`${label}: the agent carries every person the people list shows`,
      missing.length === 0, missing.length ? `MISSING ${missing.length}: ${missing.slice(0, 5).join(", ")}` : `${listed.size} people`);
    check(`${label}: and carries nobody it does not show`,
      extra.length === 0, extra.length ? `EXTRA ${extra.length}: ${extra.slice(0, 5).join(", ")}` : "none");
  } finally {
    await removeSnapshot(dir);
  }
}

/**
 * Everything this run created. Called at the START as well as in `finally`,
 * because a run killed halfway leaves rows that make the NEXT run fail for a
 * reason that has nothing to do with the code under test.
 */
async function cleanup() {
  await prisma.person.deleteMany({ where: { fullName: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { username: { startsWith: TAG } } });
  await prisma.orgNode.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.personFieldDef.deleteMany({ where: { label: { in: ["תאריך בדיקה", "שדה ריק לבדיקה"] } } });
}

/**
 * The people this suite asserts about, built rather than found.
 *
 * They MUST be assigned to a framework: `exportScopedSnapshot` selects people
 * by `teamId in <visible nodes>`, so an unassigned person is in no snapshot at
 * all. This suite used to take whichever row the database returned first — with
 * no condition — and every assertion below silently depended on that row
 * happening to have a framework. It stopped happening, four checks began
 * failing for a reason unrelated to what they test, and the run crashed on the
 * fifth, hiding everything after it.
 */
async function makeSubjects() {
  const center = await prisma.orgNode.create({ data: { name: `${TAG} מרכז`, kind: "CENTER" } });
  const domain = await prisma.orgNode.create({ data: { name: `${TAG} תחום`, kind: "DOMAIN", parentId: center.id } });
  const section = await prisma.orgNode.create({ data: { name: `${TAG} מדור`, kind: "SECTION", parentId: domain.id } });
  const team = await prisma.orgNode.create({ data: { name: `${TAG} צוות`, kind: "TEAM", parentId: section.id } });
  const base = {
    recruitmentDate: new Date("2020-01-01"),
    placementDate: new Date("2020-01-01"),
    teamId: team.id,
  };
  const withDob = await prisma.person.create({
    data: { firstName: TAG, lastName: "עם-לידה", fullName: `${TAG} עם-לידה`, birthDate: new Date(Date.UTC(1994, 6, 21)), ...base },
  });
  const noDob = await prisma.person.create({
    data: { firstName: TAG, lastName: "ללא-לידה", fullName: `${TAG} ללא-לידה`, birthDate: null, ...base },
  });
  // belongs to NO framework — an Admin sees them on the people list, so the
  // agent must carry them too. This is the person the population axis is for.
  const unassigned = await prisma.person.create({
    data: {
      firstName: TAG, lastName: "ללא-מסגרת", fullName: `${TAG} ללא-מסגרת`,
      birthDate: new Date(Date.UTC(1990, 0, 5)),
      recruitmentDate: base.recruitmentDate, placementDate: base.placementDate, teamId: null,
    },
  });

  // an Admin and a Manager scoped to one section — the population rule differs
  // between them, and "the Manager is unaffected" must be checked, not assumed
  const admin = await prisma.user.create({
    data: {
      name: `${TAG} אדמין`, email: `${TAG}a@v.invalid`, username: `${TAG}-adm`,
      passwordHash: hashPassword("x"), role: "ADMIN",
    },
    include: { grants: { select: { nodeId: true, level: true } } },
  });
  const manager = await prisma.user.create({
    data: {
      name: `${TAG} מנהל`, email: `${TAG}m@v.invalid`, username: `${TAG}-mgr`,
      passwordHash: hashPassword("x"), role: "MANAGER",
      grants: { create: [{ nodeId: section.id, level: "EDIT" }] },
    },
    include: { grants: { select: { nodeId: true, level: true } } },
  });

  return { withDob, noDob, unassigned, admin, manager };
}

async function main() {
  await cleanup();
  const { withDob, noDob, unassigned, admin, manager } = await makeSubjects();
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
    // the counts are the DATABASE's, and the snapshot holds only the assigned —
    // printed as context, never as something an assertion leans on
    const total = await prisma.person.count();
    const haveDob = await prisma.person.count({ where: { birthDate: { not: null } } });
    console.log(`     (${haveDob} of ${total} people hold a date of birth; the snapshot carries ${people.length})`);

    const iso = withDob.birthDate!.toISOString().slice(0, 10);
    check("the snapshot carries a real person's date of birth", peopleRaw.includes(iso),
      `${withDob.fullName} → ${iso}${peopleRaw.includes(iso) ? "" : " NOT IN THE SNAPSHOT"}`);

    const row = people.find((p) => p["שם"] === withDob.fullName)!;
    check("on that person's own row", row?.["תאריך_לידה"] === iso, String(row?.["תאריך_לידה"]));
    check("and the age beside it", !!row?.["גיל"], String(row?.["גיל"]));
    check("computed by the SAME function the card uses",
      row?.["גיל"] === ageFromBirthDate(withDob.birthDate), `card says ${ageFromBirthDate(withDob.birthDate)}`);

    // built, not found — and the branch that used to say "no such person in the
    // data" is gone with it: a pass for want of a subject is not a pass
    const r = people.find((p) => p["שם"] === noDob.fullName);
    check("a person with no date is present with null, not omitted", !!r && r["תאריך_לידה"] === null,
      r ? String(r["תאריך_לידה"]) : "ROW MISSING ENTIRELY");

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
    const person = withDob; // this suite's own subject, which the snapshot holds
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

    console.log("\n=== the population axis: WHO the agent carries, not only WHAT ===");
    await checkPopulation("admin", admin);
    await checkPopulation("scoped manager", manager);
    check("the unassigned person is on the admin's people list to begin with",
      (await getVisiblePeople(await computeVisibility({ id: admin.id, name: admin.name, role: admin.role, grants: admin.grants })))
        .some((p) => p.fullName === unassigned.fullName),
      "otherwise the axis above proves nothing");

    console.log("\n=== the snapshot still exposes nothing new ===");
    check("no internal ids", !/"id"\s*:/.test(peopleRaw));
    check("no password hashes", !peopleRaw.includes("passwordHash"));
    check("no absolute file paths", !/"\/(home|var|tmp)\//.test(peopleRaw));
    check("the README names the new file", (await readFile(`${dir}/README.md`, "utf8")).includes("schema.json"));
  } finally {
    await removeSnapshot(dir);
    await cleanup();
    const residue =
      (await prisma.person.count({ where: { fullName: { startsWith: TAG } } })) +
      (await prisma.orgNode.count({ where: { name: { startsWith: TAG } } }));
    check("no fixtures left behind", residue === 0, `${residue}`);
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
