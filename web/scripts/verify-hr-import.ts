/**
 * Verification for hr-import-people — the engine.
 *
 * The heart of the change is classification: every row lands in exactly one of
 * create / skip / error / possible-duplicate, for a stated reason, and nothing
 * is ever guessed — not a date, not a namesake team, not an identity. The
 * fixtures here build a small org with a deliberate namesake pair and people
 * with and without identity values, then feed crafted CSV buffers through the
 * REAL parser (xlsx), not through hand-built row arrays.
 *
 * The agent's mapping proposal needs a live model and is exercised in e2e; here
 * the deterministic recognition and the correction path are what's under test.
 *
 *   npx tsx scripts/verify-hr-import.ts
 */
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { visibilityFrom } from "@/lib/access";
import { parseTable, recognizeHeaders, resolveTeamByName, classifyRows, parseDateAs, parseRowDate, failingDateColumns, type ColumnMapping } from "@/lib/hr-import";
import { assertIdentityFree, findByIdentity, normalizeIdentity } from "@/lib/identity-keys";

const TAG = "hriverify";

let failures = 0;
let checks = 0;
function check(label: string, ok: boolean, detail = "") {
  checks++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function cleanup() {
  await prisma.person.deleteMany({ where: { fullName: { contains: TAG } } });
  await prisma.orgNode.deleteMany({ where: { name: { startsWith: TAG } } });
}

function csvBuffer(lines: string[]): Buffer {
  return Buffer.from("﻿" + lines.join("\n"), "utf8");
}

async function main() {
  await cleanup();

  // org: a section with two namesake teams, and a separate out-of-scope branch
  const center = await prisma.orgNode.create({ data: { name: `${TAG} מרכז`, kind: "CENTER" } });
  const domain = await prisma.orgNode.create({ data: { name: `${TAG} תחום`, kind: "DOMAIN", parentId: center.id } });
  const secA = await prisma.orgNode.create({ data: { name: `${TAG} מדור א`, kind: "SECTION", parentId: domain.id } });
  const secB = await prisma.orgNode.create({ data: { name: `${TAG} מדור ב`, kind: "SECTION", parentId: domain.id } });
  const teamA1 = await prisma.orgNode.create({ data: { name: `${TAG} צוות זהה`, kind: "TEAM", parentId: secA.id } });
  const teamB1 = await prisma.orgNode.create({ data: { name: `${TAG} צוות זהה`, kind: "TEAM", parentId: secB.id } });
  const teamA2 = await prisma.orgNode.create({ data: { name: `${TAG} צוות יחיד`, kind: "TEAM", parentId: secA.id } });
  // the foreign branch hangs off a SECOND domain, so a domain-scoped importer
  // genuinely cannot see it — the first draft hung it under the same domain,
  // which made "outside" quietly inside
  const domain2 = await prisma.orgNode.create({ data: { name: `${TAG} תחום אחר`, kind: "DOMAIN", parentId: center.id } });
  const outside = await prisma.orgNode.create({ data: { name: `${TAG} מדור זר`, kind: "SECTION", parentId: domain2.id } });
  const teamOut = await prisma.orgNode.create({ data: { name: `${TAG} צוות זר`, kind: "TEAM", parentId: outside.id } });

  const nodes = await prisma.orgNode.findMany({ select: { id: true, name: true, parentId: true, kind: true } });
  // the importer: HR with EDIT over the DOMAIN → scope covers both sections,
  // establishment authority everywhere beneath (grant sits at domain level)
  const domainVis = visibilityFrom(nodes as never, { id: "hr", name: "hr", role: "HR", grants: [{ nodeId: domain.id, level: "EDIT" }] });
  // a narrower importer whose grant sits on a TEAM: edit yes, establishment no
  const teamVis = visibilityFrom(nodes as never, { id: "hr2", name: "hr2", role: "HR", grants: [{ nodeId: teamA2.id, level: "EDIT" }] });
  // scope that excludes the foreign section
  const secVis = visibilityFrom(nodes as never, { id: "hr3", name: "hr3", role: "HR", grants: [{ nodeId: secA.id, level: "EDIT" }] });

  const defs = await prisma.personFieldDef.findMany({ where: { label: { in: ["תעודת זהות", "מספר אישי"] } } });
  const tzDef = defs.find((d) => d.label === "תעודת זהות")!;
  const paDef = defs.find((d) => d.label === "מספר אישי")!;

  // existing people: one in scope with identity, one out of scope with identity,
  // one in scope WITHOUT identity (the duplicate-guard case)
  const mkPerson = (first: string, team: string, fields: { defId: string; value: string }[]) =>
    prisma.person.create({
      data: {
        firstName: first, lastName: TAG, fullName: `${first} ${TAG}`,
        recruitmentDate: new Date("2020-01-01"), placementDate: new Date("2020-01-01"),
        teamId: team,
        fieldValues: { create: fields.map((f) => ({ fieldDefId: f.defId, value: f.value, order: 0 })) },
      },
    });
  await mkPerson("קיים", teamA1.id, [{ defId: tzDef.id, value: "900000001" }]);
  await mkPerson("זר", teamOut.id, [{ defId: tzDef.id, value: "900000002" }]);
  await mkPerson("חסר", teamA2.id, []); // no identity — invisible to matching
  await mkPerson("שני", teamA1.id, [{ defId: paDef.id, value: "800000003" }]);

  console.log("\n=== parsing: the real parser, both formats ===");
  const csv = parseTable(csvBuffer(["שם פרטי,שם משפחה,תעודת זהות", "א,ב,1"]), "t.csv");
  check("CSV parses to headers + rows", csv.headers.length === 3 && csv.rows.length === 1);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["שם פרטי", "תאריך לידה"], ["ג", new Date(Date.UTC(1990, 4, 7))]]), "S");
  const xls = parseTable(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer, "t.xlsx");
  check("an Excel DATE cell arrives as dd/mm/yyyy, one date language", xls.rows[0][1] === "07/05/1990", xls.rows[0][1]);

  console.log("\n=== header recognition ===");
  const rec = await recognizeHeaders(["שם פרטי", "שם משפחה", 'ת"ז', "מס' אישי", "מסגרת", "טור מוזר"]);
  check("variants map deterministically", rec.mapping[2].target === `custom:${tzDef.id}` && rec.mapping[3].target === `custom:${paDef.id}`,
    `${rec.mapping[2].target}`);
  check("the framework column is recognised", rec.mapping[4].target === "framework");
  check("the foreign header is listed for the agent, not erred", rec.unrecognized.join() === "טור מוזר");

  console.log("\n=== the resolver: in scope, namesakes refused ===");
  const one = resolveTeamByName(domainVis, nodes as never, `${TAG} צוות יחיד`);
  check("a unique name resolves", one.ok && one.teamId === teamA2.id);
  const dup = resolveTeamByName(domainVis, nodes as never, `${TAG} צוות זהה`);
  check("a namesake pair is refused asking for a path", !dup.ok && dup.reason.includes("ציין מסלול"), dup.ok ? "" : dup.reason.slice(0, 80));
  const pathed = resolveTeamByName(domainVis, nodes as never, `${TAG} מדור ב / ${TAG} צוות זהה`);
  check("a path fragment disambiguates", pathed.ok && pathed.teamId === teamB1.id);
  const far = resolveTeamByName(secVis, nodes as never, `${TAG} צוות זר`);
  check("a team outside the scope does not exist for the resolver", !far.ok);

  console.log("\n=== classification: every branch, stated reasons ===");
  const mapping: ColumnMapping = [
    { header: "שם פרטי", target: "firstName" }, { header: "שם משפחה", target: "lastName" },
    { header: "תז", target: `custom:${tzDef.id}` }, { header: "מא", target: `custom:${paDef.id}` },
    { header: "לידה", target: "birthDate" }, { header: "גיוס", target: "recruitmentDate" },
    { header: "מסגרת", target: "framework" },
  ];
  const rows = [
    ["קיים", TAG, "900000001", "", "01/01/1990", "01/01/2020", `${TAG} צוות יחיד`],          // exists in scope → skip
    ["זר", TAG, "900000002", "", "01/01/1990", "01/01/2020", `${TAG} צוות יחיד`],            // exists outside → error
    ["סתירה", TAG, "900000001", "800000003", "01/01/1990", "01/01/2020", `${TAG} צוות יחיד`], // keys → two people
    ["חדש", TAG, "900000010", "", "02/02/1992", "03/03/2021", `${TAG} צוות יחיד`],           // clean create
    ["חסר", TAG, "900000011", "", "02/02/1992", "03/03/2021", `${TAG} צוות יחיד`],           // same name as identity-less → halt
    ["תאריך", TAG, "900000012", "", "31/02/1990", "03/03/2021", `${TAG} צוות יחיד`],         // impossible date → error
    ["כפול", TAG, "900000013", "", "02/02/1992", "03/03/2021", `${TAG} צוות זהה`],           // namesake team → error
    ["בלי", TAG, "900000014", "", "02/02/1992", "03/03/2021", ""],                            // no framework → error
  ];
  const plan = await classifyRows(domainVis, mapping, rows);
  const byName = (n: string) => plan.rows.find((r) => r.name.startsWith(n))!;
  check("exists-in-scope → skip", byName("קיים").kind === "skip", byName("קיים").kind);
  const outsideRow = byName("זר");
  check("exists-outside → error, framework NOT revealed", outsideRow.kind === "error" &&
    "reason" in outsideRow && outsideRow.reason.includes("מסגרת אחרת") && !outsideRow.reason.includes("זר"),
    "reason" in outsideRow ? outsideRow.reason : "");
  check("key conflict → error naming both people", byName("סתירה").kind === "error" &&
    (byName("סתירה") as { reason: string }).reason.includes("סתירת מפתחות"));
  check("a clean new person → create into the resolved team",
    byName("חדש").kind === "create" && (byName("חדש") as { teamId: string }).teamId === teamA2.id);
  check("a namesake of the identity-less → possible-duplicate halt, not create and not silent skip",
    byName("חסר").kind === "duplicate-halt", byName("חסר").kind);
  check("an impossible REQUIRED date → still an error, never guessed", byName("תאריך").kind === "error" &&
    (byName("תאריך") as { reason: string }).reason.includes("31/02/1990"));
  // the softened rules: an unresolvable framework no longer blocks the person
  const dupTeam = byName("כפול");
  check("a namesake team → created WITHOUT a framework, warned", dupTeam.kind === "create" &&
    (dupTeam as { teamId: string | null }).teamId === null &&
    (dupTeam as { warnings: string[] }).warnings.some((w) => w.includes("ללא מסגרת")),
    dupTeam.kind);
  const noTeam = byName("בלי");
  check("no framework at all → created unassigned, warned", noTeam.kind === "create" &&
    (noTeam as { teamId: string | null }).teamId === null);
  check("the counts agree with the rows", plan.counts.create === 3 && plan.counts.skip === 1 && plan.counts.halt === 1 && plan.counts.error === 3,
    JSON.stringify(plan.counts));

  console.log("\n=== the soft rule: optional faults warn, they do not block ===");
  const softMapping: ColumnMapping = [
    { header: "שם פרטי", target: "firstName" }, { header: "שם משפחה", target: "lastName" },
    { header: "לידה", target: "birthDate" }, { header: "גיוס", target: "recruitmentDate" },
    { header: "הצבה", target: "placementDate" }, { header: "מסגרת", target: "framework" },
    { header: "מצב", target: `custom:${(await prisma.personFieldDef.findFirstOrThrow({ where: { type: "ENUM" } })).id}` },
  ];
  const soft = await classifyRows(domainVis, softMapping, [
    ["רך", TAG, "05/05/1995", "01/01/2022", "לא-תאריך", `${TAG} צוות יחיד`, "ערך-שאינו-באפשרויות"],
  ]);
  const softRow = soft.rows[0];
  check("a bad OPTIONAL date drops with a warning, the person still creates",
    softRow.kind === "create" && (softRow as { warnings: string[] }).warnings.some((w) => w.includes("הושמט")),
    softRow.kind);
  check("an ENUM value outside its options drops with a warning, never written",
    softRow.kind === "create" && (softRow as { warnings: string[] }).warnings.some((w) => w.includes("אינו ערך מותר")) &&
    (softRow as { data: { custom: unknown[] } }).data.custom.length === 0);
  check("the dropped placement falls back to the recruitment date",
    (softRow as { data: { placementDate: string } }).data.placementDate === "01/01/2022");

  console.log("\n=== date-format interpretation stays structural ===");
  check("ymd parses under its order", parseDateAs("1994-02-15", "ymd")?.toISOString().slice(0, 10) === "1994-02-15");
  check("mdy parses under its order", parseDateAs("02/15/1994", "mdy")?.toISOString().slice(0, 10) === "1994-02-15");
  check("31/02 is impossible under EVERY order", ["dmy", "mdy", "ymd"].every((o) => parseDateAs("31/02/1994", o as never) === null));
  check("the standard gate still wins first", parseRowDate("15/02/1994", "ymd")?.toISOString().slice(0, 10) === "1994-02-15");
  // note: ISO (yyyy-mm-dd) is already readable by the standard gate, so it
  // never reaches the agent — only genuinely foreign orders like mdy do
  const failing = failingDateColumns(
    [{ header: "לידה", target: "birthDate" }, { header: "שם", target: "firstName" }],
    [["02/15/1994", "א"], ["15/02/1994", "ב"], ["02/15/1994", "ג"]],
  );
  check("only unreadable DATE values reach the agent, deduplicated",
    failing.length === 1 && failing[0].samples.join() === "02/15/1994", JSON.stringify(failing));

  console.log("\n=== establishment authority gates creation ===");
  const teamPlan = await classifyRows(teamVis, [
    { header: "שם פרטי", target: "firstName" }, { header: "שם משפחה", target: "lastName" },
    { header: "לידה", target: "birthDate" }, { header: "גיוס", target: "recruitmentDate" },
    { header: "מסגרת", target: "framework" },
  ], [["חדשה", TAG, "05/05/1995", "01/01/2022", `${TAG} צוות יחיד`]]);
  check("a team-level grant may edit but NOT establish — the row errs naming the authority",
    teamPlan.rows[0].kind === "error" && (teamPlan.rows[0] as { reason: string }).reason.includes("סמכות הקמה"),
    (teamPlan.rows[0] as { reason?: string }).reason ?? "");

  console.log("\n=== identity uniqueness in the writing layer ===");
  let refused = "";
  try {
    await assertIdentityFree([{ label: "תעודת זהות", value: "900-000-001" }]); // separators must not evade
  } catch (e) { refused = (e as Error).message; }
  check("a taken value is refused BY NAME, separators notwithstanding", refused.includes("קיים"), refused.slice(0, 70));
  const owner = await prisma.person.findFirstOrThrow({ where: { fullName: `קיים ${TAG}` } });
  let own = "ok";
  try { await assertIdentityFree([{ label: "תעודת זהות", value: "900000001" }], owner.id); } catch (e) { own = (e as Error).message; }
  check("re-saving your own value passes — it belongs to you", own === "ok", own);
  const found = await findByIdentity({ tz: "900000001" });
  check("findByIdentity honours the fixed order and normalisation", found.length === 1 && found[0].personId === owner.id);
  check("normalizeIdentity strips everything non-digit", normalizeIdentity(" 900-000.001 ") === "900000001");

  await cleanup();
  check("no fixtures left behind",
    (await prisma.person.count({ where: { fullName: { contains: TAG } } })) === 0 &&
    (await prisma.orgNode.count({ where: { name: { startsWith: TAG } } })) === 0);

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
