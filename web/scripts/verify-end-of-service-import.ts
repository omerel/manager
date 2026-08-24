/**
 * Verification for import-end-of-service — «תאריך סיום שירות» as the eighth
 * core mapping target, optional and nullable, in both HR flows.
 *
 *   npx tsx scripts/verify-end-of-service-import.ts
 */
import { prisma } from "@/lib/prisma";
import { visibilityFrom } from "@/lib/access";
import { recognizeHeaders, classifyRows, type ColumnMapping } from "@/lib/hr-import";
import { buildUpdatePlan, type UpdateMapping } from "@/lib/hr-update";
import { applyProposalItem } from "@/lib/apply-proposal";
import { formatIsraeliDate } from "@/lib/dates";

const TAG = "eosverify";

let failures = 0;
let checks = 0;
function check(label: string, ok: boolean, detail = "") {
  checks++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function cleanup() {
  await prisma.person.deleteMany({ where: { fullName: { startsWith: TAG } } });
  await prisma.orgNode.deleteMany({ where: { name: { startsWith: TAG } } });
}

async function main() {
  await cleanup();
  const center = await prisma.orgNode.create({ data: { name: `${TAG} מרכז`, kind: "CENTER" } });
  const domain = await prisma.orgNode.create({ data: { name: `${TAG} תחום`, kind: "DOMAIN", parentId: center.id } });
  const section = await prisma.orgNode.create({ data: { name: `${TAG} מדור`, kind: "SECTION", parentId: domain.id } });
  const team = await prisma.orgNode.create({ data: { name: `${TAG} צוות`, kind: "TEAM", parentId: section.id } });
  const nodes = await prisma.orgNode.findMany({ select: { id: true, name: true, parentId: true, kind: true } });
  const admin = visibilityFrom(nodes, { id: "x", name: "adm", role: "ADMIN", grants: [] });

  try {
    console.log("=== recognition: the header variants land on the target ===");
    for (const h of ["תאריך סיום שירות", "תת״ש", "סיום שירות", "End of Service"]) {
      const { mapping } = await recognizeHeaders([h]);
      check(`«${h}» is recognised`, mapping[0].target === "endOfServiceDate", mapping[0].target);
    }
    const { mapping: strange } = await recognizeHeaders(["טור מוזר לגמרי"]);
    check("an unrelated header still falls to ignore", strange[0].target === "ignore");

    console.log("\n=== import: the date rides the row, optionally ===");
    const headers = ["שם מלא", "תאריך לידה", "תאריך גיוס", "מסגרת", "תת״ש"];
    const { mapping } = await recognizeHeaders(headers);
    check("the whole test file is recognised without an agent", mapping.every((m) => m.target !== "ignore"));

    const rows = [
      [`${TAG} אחד כהן`, "01/02/1990", "01/03/2020", `${TAG} צוות`, "15/07/2027"],
      [`${TAG} שתיים לוי`, "02/02/1990", "01/03/2020", `${TAG} צוות`, ""],
      [`${TAG} שלוש מזרחי`, "03/02/1990", "01/03/2020", `${TAG} צוות`, "לא-תאריך"],
    ];
    const plan = await classifyRows(admin, mapping, rows);
    const [withDate, without, unreadable] = plan.rows;
    check("all three rows create", plan.counts.create === 3, JSON.stringify(plan.counts));
    check("a given value arrives formatted on the plan",
      withDate.kind === "create" && withDate.data.endOfServiceDate === "15/07/2027",
      withDate.kind === "create" ? String(withDate.data.endOfServiceDate) : withDate.kind);
    check("an empty value stays absent — no fallback invented",
      without.kind === "create" && without.data.endOfServiceDate === undefined);
    check("an unreadable value is dropped with a warning, row still creates",
      unreadable.kind === "create" && unreadable.data.endOfServiceDate === undefined &&
      unreadable.warnings.some((w) => w.includes("סיום שירות")),
      unreadable.kind === "create" ? unreadable.warnings.join("; ") : unreadable.kind);

    console.log("\n=== update: change proposes, emptiness proposes deletion ===");
    const tzDef = await prisma.personFieldDef.findFirst({ where: { label: "תעודת זהות" }, select: { id: true, order: true } });
    check("the identity field def exists (seeded)", !!tzDef);
    const person = await prisma.person.create({
      data: {
        firstName: TAG, lastName: "מעודכן", fullName: `${TAG} מעודכן`,
        recruitmentDate: new Date("2020-03-01"), placementDate: new Date("2020-03-01"),
        endOfServiceDate: new Date("2026-12-31"), teamId: team.id,
        fieldValues: { create: [{ fieldDefId: tzDef!.id, value: "123456782", order: tzDef!.order }] },
      },
    });
    const uHeaders = ["תעודת זהות", "תת״ש"];
    const uMapping: UpdateMapping = (await recognizeHeaders(uHeaders)).mapping.map((m: ColumnMapping[number]) => ({
      header: m.header, targets: [m.target],
    }));
    const planFor = (val: string) =>
      buildUpdatePlan(admin, uMapping, uHeaders, [["123456782", val]], new Map([["123456782", new Set([1])]]));

    const changed = await planFor("01/06/2028");
    check("a different date proposes an update",
      changed.people.length === 1 &&
      changed.people[0].items.some((i) => i.key === "endOfServiceDate" && i.proposed === "01/06/2028" && i.kind !== "delete"));
    const emptied = await planFor("");
    const delItem = emptied.people[0]?.items.find((i) => i.key === "endOfServiceDate");
    check("an emptied cell proposes a deletion — the nullable date may be cleared",
      !!delItem && delItem.kind === "delete" && delItem.current === "31/12/2026");
    const same = await planFor("31/12/2026");
    check("an equal value proposes nothing", (same.people[0]?.items ?? []).length === 0);

    console.log("\n=== apply: the engine writes and clears the column ===");
    await applyProposalItem(person.id, { key: "endOfServiceDate", label: "תאריך סיום שירות", current: "31/12/2026", proposed: "01/06/2028" });
    let now = await prisma.person.findUniqueOrThrow({ where: { id: person.id }, select: { endOfServiceDate: true } });
    check("an approved update lands on the card", !!now.endOfServiceDate && formatIsraeliDate(now.endOfServiceDate) === "01/06/2028");
    await applyProposalItem(person.id, { key: "endOfServiceDate", label: "תאריך סיום שירות", current: "01/06/2028", proposed: "", kind: "delete" });
    now = await prisma.person.findUniqueOrThrow({ where: { id: person.id }, select: { endOfServiceDate: true } });
    check("an approved deletion clears the column to null", now.endOfServiceDate === null);
  } finally {
    await cleanup();
    const residue = (await prisma.person.count({ where: { fullName: { startsWith: TAG } } })) +
      (await prisma.orgNode.count({ where: { name: { startsWith: TAG } } }));
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
