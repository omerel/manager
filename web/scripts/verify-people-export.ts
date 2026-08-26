/**
 * Verification for people-excel-export — the workbook, read back with the same
 * library that wrote it.
 *
 * Needs the dev server on :4321.
 *
 *   npx tsx scripts/verify-people-export.ts
 */
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { exportColumns, customKey } from "@/lib/people-export";
import { getFieldDefs } from "@/lib/person-schema";

const BASE = process.env.BASE_URL ?? "http://localhost:4321";
const TAG = "pxverify";

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
  await prisma.orgNode.deleteMany({ where: { name: { startsWith: TAG } } });
}

/** The returned workbook as a grid of strings. */
async function grid(res: Response): Promise<string[][]> {
  const wb = XLSX.read(Buffer.from(await res.arrayBuffer()), { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "", raw: false });
}

async function main() {
  await cleanup();
  const center = await prisma.orgNode.create({ data: { name: `${TAG} מרכז`, kind: "CENTER" } });
  const domain = await prisma.orgNode.create({ data: { name: `${TAG} תחום`, kind: "DOMAIN", parentId: center.id } });
  const section = await prisma.orgNode.create({ data: { name: `${TAG} מדור`, kind: "SECTION", parentId: domain.id } });
  const mine = await prisma.orgNode.create({ data: { name: `${TAG} צוות שלי`, kind: "TEAM", parentId: section.id } });
  const other = await prisma.orgNode.create({ data: { name: `${TAG} צוות זר`, kind: "TEAM", parentId: section.id } });

  const admin = await prisma.user.create({
    data: { name: `${TAG} אדמין`, email: `${TAG}a@verify.invalid`, username: `${TAG}-adm`, passwordHash: hashPassword("x"), role: "ADMIN" },
  });
  const manager = await prisma.user.create({
    data: {
      name: `${TAG} מפקד`, email: `${TAG}m@verify.invalid`, username: `${TAG}-mgr`, passwordHash: hashPassword("x"), role: "MANAGER",
      grants: { create: [{ nodeId: mine.id, level: "EDIT" }] },
    },
  });

  const defs = await getFieldDefs();
  const cityDef = defs.find((d) => d.label === "עיר מגורים");
  const full = await prisma.person.create({
    data: {
      firstName: `${TAG}שם`, lastName: "מלא", fullName: `${TAG}שם מלא`,
      birthDate: new Date("1995-04-17"), recruitmentDate: new Date("2020-03-01"), placementDate: new Date("2020-09-01"),
      teamId: mine.id,
      fieldValues: cityDef ? { create: [{ fieldDefId: cityDef.id, value: "חיפה", order: cityDef.order }] } : undefined,
    },
  });
  // deliberately sparse: no birth date, no card values — the empty-cell case
  const sparse = await prisma.person.create({
    data: {
      firstName: `${TAG}שם`, lastName: "דליל", fullName: `${TAG}שם דליל`,
      recruitmentDate: new Date("2022-01-05"), placementDate: new Date("2022-01-05"), teamId: mine.id,
    },
  });
  await prisma.person.create({
    data: {
      firstName: `${TAG}שם`, lastName: "זר", fullName: `${TAG}שם זר`,
      recruitmentDate: new Date("2021-01-01"), placementDate: new Date("2021-01-01"), teamId: other.id,
    },
  });

  const catalogue = exportColumns(defs);
  const post = (userId: string, keys: string[]) => {
    const body = new URLSearchParams();
    for (const k of keys) body.append("column", k);
    return fetch(`${BASE}/api/people-export`, {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE}=${createSessionToken(userId)}`, "content-type": "application/x-www-form-urlencoded" },
      body,
    });
  };

  try {
    console.log("=== the default export: every card value, every visible person ===");
    const res = await post(admin.id, catalogue.map((c) => c.key));
    check("the route answers with a workbook", res.status === 200 &&
      (res.headers.get("content-type") ?? "").includes("spreadsheetml"), `HTTP ${res.status}`);
    const g = await grid(res);
    check("the header row is the catalogue's labels, in order",
      JSON.stringify(g[0]) === JSON.stringify(catalogue.map((c) => c.label)), g[0]?.slice(0, 3).join(" | "));
    const rowOf = (name: string) => g.find((r) => r.includes(name.replace(`${TAG}שם `, `${TAG}שם`)) || r.some((c) => c === name));
    const at = (row: string[] | undefined, key: string) => row?.[catalogue.findIndex((c) => c.key === key)] ?? "(missing)";
    const fullRow = g.find((r) => r[1] === "מלא");
    const sparseRow = g.find((r) => r[1] === "דליל");
    void rowOf;
    check("a person's row carries their real values",
      at(fullRow, "birthDate") === "17/04/1995" && at(fullRow, "recruitmentDate") === "01/03/2020" &&
      at(fullRow, "placementDate") === "01/09/2020",
      `${at(fullRow, "birthDate")} · ${at(fullRow, "placementDate")}`);
    check("the framework is the full path, not a bare team name",
      at(fullRow, "orgPath").includes("▸") && at(fullRow, "orgPath").includes("צוות שלי"), at(fullRow, "orgPath"));
    check("a custom card value is exported", !cityDef || at(fullRow, customKey(cityDef.id)) === "חיפה");
    check("dates are written as Israeli dates", /^\d{2}\/\d{2}\/\d{4}$/.test(at(fullRow, "recruitmentDate")));
    check("employment status is exported as its label", at(fullRow, "status").length > 0 && at(fullRow, "status") !== "ACTIVE",
      at(fullRow, "status"));

    console.log("\n=== an absent value is an EMPTY cell, never the screen's «—» ===");
    check("the sparse person has no birth date cell", at(sparseRow, "birthDate") === "", `"${at(sparseRow, "birthDate")}"`);
    check("...and no card value", !cityDef || at(sparseRow, customKey(cityDef.id)) === "");
    check("no cell anywhere carries the screen placeholder", !g.some((r) => r.includes("—")));
    check("no plan reads empty rather than «ללא מסלול»", at(sparseRow, "planName") === "");

    console.log("\n=== the chosen columns, and only those ===");
    const few = await post(admin.id, ["lastName", "orgPath"]);
    const fg = await grid(few);
    check("only the chosen columns are present", JSON.stringify(fg[0]) === JSON.stringify(["שם משפחה", "שיוך לצוות"]),
      fg[0]?.join(" | "));
    check("...in catalogue order regardless of the request's order",
      JSON.stringify((await grid(await post(admin.id, ["orgPath", "lastName"])))[0]) ===
        JSON.stringify(["שם משפחה", "שיוך לצוות"]));
    check("an unknown key is ignored rather than failing the export",
      (await post(admin.id, ["lastName", "field:no-such-def"])).status === 200);
    check("choosing nothing is refused with a reason", (await post(admin.id, [])).status === 400);
    check("without a session the route refuses",
      (await fetch(`${BASE}/api/people-export`, { method: "POST", body: new URLSearchParams({ column: "lastName" }) })).status === 401);

    console.log("\n=== the export cannot widen visibility, and ignores the filter ===");
    const mg = await grid(await post(manager.id, catalogue.map((c) => c.key)));
    const names = mg.slice(1).map((r) => r[1]);
    check("the manager receives their own team's people", names.includes("מלא") && names.includes("דליל"), names.join(", "));
    check("...and not the neighbouring team's", !names.includes("זר"));
    check("the admin, who sees everything, does get that person", g.slice(1).some((r) => r[1] === "זר"));

    const logged = await prisma.activityLog.count({ where: { action: "people.export" } });
    check("every export is recorded in the activity log", logged >= 5, `${logged}`);
  } finally {
    await cleanup();
    const residue = (await prisma.person.count({ where: { fullName: { startsWith: TAG } } })) +
      (await prisma.orgNode.count({ where: { name: { startsWith: TAG } } }));
    check("no fixtures left behind", residue === 0, `${residue}`);
    void full; void sparse;
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
