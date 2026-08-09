/**
 * Verification for hr-external-update — the engine.
 *
 * The claim that carries the feature: a proposal exists ONLY when both diff
 * stages say yes — the cell changed in the file AND differs from the system.
 * The case to guard hardest is the one the user called out by name: a hand
 * correction in the system must survive an unchanged file. It is tested with
 * data where every other combination also appears, so a pass cannot be
 * accidental.
 *
 *   npx tsx scripts/verify-hr-update.ts
 */
import { prisma } from "@/lib/prisma";
import { visibilityFrom } from "@/lib/access";
import {
  headersSignature,
  structureDiff,
  changedCells,
  buildUpdatePlan,
  careerTargets,
  staleMappingTargets,
  type UpdateMapping,
} from "@/lib/hr-update";

const TAG = "hruverify";

let failures = 0;
let checks = 0;
function check(label: string, ok: boolean, detail = "") {
  checks++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function cleanup() {
  await prisma.person.deleteMany({ where: { fullName: { contains: TAG } } });
  await prisma.careerPlan.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.orgNode.deleteMany({ where: { name: { startsWith: TAG } } });
}

async function main() {
  await cleanup();

  // org + two plan TEMPLATES sharing a point-event label — the multi-career case
  const center = await prisma.orgNode.create({ data: { name: `${TAG} מרכז`, kind: "CENTER" } });
  const domain = await prisma.orgNode.create({ data: { name: `${TAG} תחום`, kind: "DOMAIN", parentId: center.id } });
  const sec = await prisma.orgNode.create({ data: { name: `${TAG} מדור`, kind: "SECTION", parentId: domain.id } });
  const team = await prisma.orgNode.create({ data: { name: `${TAG} צוות`, kind: "TEAM", parentId: sec.id } });
  const teamOut = await prisma.orgNode.create({
    data: { name: `${TAG} צוות זר`, kind: "TEAM",
      parentId: (await prisma.orgNode.create({ data: { name: `${TAG} מדור זר`, kind: "SECTION", parentId: (await prisma.orgNode.create({ data: { name: `${TAG} תחום זר`, kind: "DOMAIN", parentId: center.id } })).id } })).id },
  });

  const tplA = await prisma.careerPlan.create({
    data: { name: `${TAG} תכנית א`, isTemplate: true,
      pointEvents: { create: [{ label: `${TAG} הסמכה`, offsetMonths: 12 }] },
      cumulativeMetrics: { create: [{ name: `${TAG} שעות`, unit: "שעות", }] } },
    include: { pointEvents: true, cumulativeMetrics: true },
  });
  const tplB = await prisma.careerPlan.create({
    data: { name: `${TAG} תכנית ב`, isTemplate: true,
      pointEvents: { create: [{ label: `${TAG} הסמכה`, offsetMonths: 6 }] } },
    include: { pointEvents: true },
  });

  // person copies: אבי on a COPY of A, בני on a COPY of B, גדי outside scope
  const defs = await prisma.personFieldDef.findMany({ where: { label: { in: ["תעודת זהות", "מספר אישי"] } } });
  const tzDef = defs.find((d) => d.label === "תעודת זהות")!;
  const mkCopy = async (tpl: "a" | "b") => {
    const src = tpl === "a" ? tplA : tplB;
    return prisma.careerPlan.create({
      data: { name: `${src.name} (עותק)`, isTemplate: false,
        pointEvents: { create: src.pointEvents.map((e) => ({ label: e.label, offsetMonths: e.offsetMonths })) },
        ...(tpl === "a" ? { cumulativeMetrics: { create: [{ name: `${TAG} שעות`, unit: "שעות" }] } } : {}) },
      include: { pointEvents: true, cumulativeMetrics: true },
    });
  };
  const copyA = await mkCopy("a");
  const copyB = await mkCopy("b");
  const mkP = (first: string, tz: string, teamId: string, planId: string | null) =>
    prisma.person.create({
      data: { firstName: first, lastName: TAG, fullName: `${first} ${TAG}`,
        recruitmentDate: new Date("2020-01-01"), placementDate: new Date("2020-01-01"),
        teamId, assignedPlanId: planId,
        fieldValues: { create: [{ fieldDefId: tzDef.id, value: tz, order: 0 }] } },
    });
  const avi = await mkP("אבי", "600000001", team.id, copyA.id);
  await mkP("בני", "600000002", team.id, copyB.id);
  await mkP("גדי", "600000003", teamOut.id, null);

  const nodes = await prisma.orgNode.findMany({ select: { id: true, name: true, parentId: true, kind: true } });
  const vis = visibilityFrom(nodes as never, { id: "hr", name: "hr", role: "HR", grants: [{ nodeId: sec.id, level: "EDIT" }] });

  console.log("\n=== signature and structure ===");
  const h1 = ["תעודת זהות", "עיר מגורים", `${TAG} הסמכה`];
  check("the signature is order- and punctuation-blind",
    headersSignature(h1) === headersSignature(["עיר-מגורים", `${TAG} הסמכה`, "תעודת זהות."]));
  check("and changes when a header changes", headersSignature(h1) !== headersSignature([...h1, "חדש"]));
  const sd = structureDiff(h1, ["תעודת זהות", "עיר מגורים", "טור חדש"]);
  check("structureDiff names appeared and vanished", sd.appeared.join() === "טור חדש" && sd.vanished.join() === `${TAG} הסמכה`);

  console.log("\n=== career targets speak labels, evaluations absent ===");
  const targets = await careerTargets();
  check("the shared label appears once across templates", targets.points.filter((p) => p === `${TAG} הסמכה`).length === 1);
  check("metrics listed", targets.metrics.includes(`${TAG} שעות`));
  const stale = await staleMappingTargets([{ header: "עמודה", targets: [`point:${TAG} לא-קיים`] }]);
  check("a label no template carries is flagged, not silently dead", stale.length === 1, stale[0] ?? "");

  console.log("\n=== the two-stage diff ===");
  const headers = ["תעודת זהות", "עיר מגורים"];
  const mapping: UpdateMapping = [
    { header: "תעודת זהות", targets: [`custom:${tzDef.id}`] },
    { header: "עיר מגורים", targets: [`custom:${(await prisma.personFieldDef.findFirstOrThrow({ where: { label: "עיר מגורים" } })).id}`] },
  ];
  // first run: no snapshot → everything passes stage one
  const first = changedCells(headers, [["600000001", "חיפה"]], 0, null);
  check("first run: every cell passes stage one — the initial feed", first.get("600000001")?.size === 2);

  // stage one filters: identical old file → nothing passes
  const prev = { headers, rows: [["600000001", "חיפה"]] };
  const same = changedCells(headers, [["600000001", "חיפה"]], 0, prev);
  check("an unchanged file passes nothing", (same.get("600000001")?.size ?? 0) === 0);
  const moved = changedCells(headers, [["600000001", "תל אביב"]], 0, prev);
  check("a changed cell passes, and only it", moved.get("600000001")?.size === 1);
  // column order changed between files — alignment is by header, not position
  const reordered = changedCells(headers, [["600000001", "חיפה"]], 0, { headers: ["עיר מגורים", "תעודת זהות"], rows: [["חיפה", "600000001"]] });
  check("old-file alignment is by HEADER — a reordered file is not all-changed", (reordered.get("600000001")?.size ?? 0) === 0);

  console.log("\n=== the master rule: the file never overrides by silence ===");
  // the system says חיפה (hand-corrected); the file has said ירושלים for two weeks
  const cityDef = await prisma.personFieldDef.findFirstOrThrow({ where: { label: "עיר מגורים" } });
  await prisma.personFieldValue.upsert({
    where: { personId_fieldDefId: { personId: avi.id, fieldDefId: cityDef.id } },
    create: { personId: avi.id, fieldDefId: cityDef.id, value: "חיפה", order: 0 },
    update: { value: "חיפה" },
  });
  const stale2 = changedCells(headers, [["600000001", "ירושלים"]], 0, { headers, rows: [["600000001", "ירושלים"]] });
  const planStale = await buildUpdatePlan(vis, mapping, headers, [["600000001", "ירושלים"]], stale2, {});
  check("hand correction SURVIVES an unchanged file — no proposal at all", planStale.people.length === 0,
    `${planStale.people.length} people proposed`);
  // but when the FILE changes, the difference is proposed against the current value
  const nowChanged = changedCells(headers, [["600000001", "באר שבע"]], 0, { headers, rows: [["600000001", "ירושלים"]] });
  const planChanged = await buildUpdatePlan(vis, mapping, headers, [["600000001", "באר שבע"]], nowChanged, {});
  const item = planChanged.people[0]?.items[0];
  check("a changed file proposes against the CURRENT system value", item?.current === "חיפה" && item?.proposed === "באר שבע",
    JSON.stringify(item ?? {}));

  console.log("\n=== per-plan resolution of a shared label ===");
  const hdr2 = ["תעודת זהות", "הסמכה"];
  const map2: UpdateMapping = [
    { header: "תעודת זהות", targets: [`custom:${tzDef.id}`] },
    { header: "הסמכה", targets: [`point:${TAG} הסמכה`] },
  ];
  const all2 = changedCells(hdr2, [["600000001", "05/03/2024"], ["600000002", "06/04/2024"]], 0, null);
  const plan2 = await buildUpdatePlan(vis, map2, hdr2, [["600000001", "05/03/2024"], ["600000002", "06/04/2024"]], all2, {});
  check("both people get the proposal — each against their OWN plan copy", plan2.people.length === 2,
    `${plan2.people.length}`);
  check("the items speak the label, dated from the file",
    plan2.people.every((p) => p.items[0]?.key === `point:${TAG} הסמכה` && p.items[0]?.proposed.length === 10));

  console.log("\n=== deletions only where legal; required warns ===");
  await prisma.pointProgress.create({ data: { personId: avi.id, pointEventId: copyA.pointEvents[0].id, doneOn: new Date("2024-03-05") } });
  const del = changedCells(hdr2, [["600000001", ""]], 0, { headers: hdr2, rows: [["600000001", "05/03/2024"]] });
  const planDel = await buildUpdatePlan(vis, map2, hdr2, [["600000001", ""]], del, {});
  const delItem = planDel.people[0]?.items[0];
  check("an emptied point value proposes a DELETION", delItem?.kind === "delete" && delItem.key === `point:${TAG} הסמכה`,
    JSON.stringify(delItem ?? {}));
  const hdr3 = ["תעודת זהות", "תאריך לידה"];
  const map3: UpdateMapping = [
    { header: "תעודת זהות", targets: [`custom:${tzDef.id}`] },
    { header: "תאריך לידה", targets: ["birthDate"] },
  ];
  await prisma.person.update({ where: { id: avi.id }, data: { birthDate: new Date("1990-01-01") } });
  const emptyReq = changedCells(hdr3, [["600000001", ""]], 0, { headers: hdr3, rows: [["600000001", "01/01/1990"]] });
  const planReq = await buildUpdatePlan(vis, map3, hdr3, [["600000001", ""]], emptyReq, {});
  check("an emptied REQUIRED cell warns and never proposes deletion",
    planReq.people[0]?.items.length === 0 && planReq.people[0]?.warnings.some((w) => w.includes("אינו נמחק")),
    JSON.stringify(planReq.people[0]?.warnings ?? []));
  check("the identity value itself is never an update payload",
    (await buildUpdatePlan(vis, mapping, headers, [["600000009", "חיפה"]],
      changedCells(headers, [["600000009", "חיפה"]], 0, null), {})).people.length === 0,
    "an unknown identity proposes nothing (and is counted as skipped)");

  console.log("\n=== a person carrying BOTH identity values ===");
  // the regression that muted the demo: the person index knows both keys, the
  // row matches by ONE — the changed-cells lookup must use the ROW's key
  const paDef = defs.find((d) => d.label === "מספר אישי")!;
  await prisma.personFieldValue.create({ data: { personId: avi.id, fieldDefId: paDef.id, value: "610000001", order: 0 } });
  const dual = changedCells(headers, [["600000001", "קריית גת"]], 0, null);
  const planDual = await buildUpdatePlan(vis, mapping, headers, [["600000001", "קריית גת"]], dual, {});
  check("a row matching by ת״ז proposes even though the person ALSO holds a מספר אישי",
    planDual.people.length === 1 && planDual.people[0].items.length === 1,
    `${planDual.people.length} people — the two-key reverse-lookup bug`);

  console.log("\n=== silences ===");
  const unknown = await buildUpdatePlan(vis, mapping, headers, [["999999999", "חיפה"]],
    changedCells(headers, [["999999999", "חיפה"]], 0, null), {});
  check("an unknown person is skipped in silence, counted", unknown.skippedUnknown === 1 && unknown.people.length === 0);
  const outside = await buildUpdatePlan(vis, mapping, headers, [["600000003", "חיפה"]],
    changedCells(headers, [["600000003", "חיפה"]], 0, null), {});
  check("an out-of-scope person produces nothing", outside.skippedOutOfScope === 1 && outside.people.length === 0);

  await cleanup();
  check("no fixtures left behind",
    (await prisma.person.count({ where: { fullName: { contains: TAG } } })) === 0 &&
    (await prisma.careerPlan.count({ where: { name: { startsWith: TAG } } })) === 0);

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
