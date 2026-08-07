/**
 * Verification for commander-queries — the rules layer.
 *
 * Three claims carry this feature, and each has a way of quietly failing:
 *
 *   openness is DERIVED     — a stored flag would drift; here it must track a
 *                             deadline that moves in both directions
 *   both ends are ANCHORED  — to frameworks, so replacing a commander mid-query
 *     to frameworks           orphans nothing on either end
 *   the audience is CLOSED   — sender and target only: not siblings, not the
 *                             level above, and not the Admin
 *
 * The actions themselves begin with a session lookup that a bare script cannot
 * satisfy, so they are driven through the real forms in
 * verify-commander-queries-e2e.ts. Here the rules are exercised directly.
 *
 *   npx tsx scripts/verify-commander-queries.ts
 */
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { todayMarker } from "@/lib/dates";
import {
  canSendFrom,
  commandedFrameworks,
  isOpen,
  mayAnswer,
  mayRead,
  outstandingCount,
  queryBadge,
  recipientsOf,
  validRecipient,
} from "@/lib/queries";

const TAG = "cqverify";
const MAIL = `@${TAG}.invalid`;

let failures = 0;
let checks = 0;
function check(label: string, ok: boolean, detail = "") {
  checks++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function cleanup() {
  await prisma.query.deleteMany({ where: { title: { startsWith: TAG } } });
  await prisma.person.deleteMany({ where: { fullName: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: MAIL } } });
  await prisma.orgNode.deleteMany({ where: { name: { startsWith: TAG } } }); // queries cascade with the frameworks
}

/** A stored date: UTC midnight of a calendar day, the shape the app persists. */
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/**
 * The instant `new Date()` would return at a given LOCAL wall-clock hour.
 *
 * Built with the local constructor on purpose. Adding hours to a UTC midnight
 * looks equivalent and is not: at UTC+3, "23:00 on the 10th" built that way is
 * really 02:00 on the 11th, and a test written that way asserts the opposite of
 * what it reads like.
 */
const at = (iso: string, hour: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, hour);
};

type Fx = { center: string; d1: string; d2: string; s1: string; s2: string; t1: string };

async function scaffold(): Promise<Fx> {
  const center = await prisma.orgNode.create({ data: { name: `${TAG} מרכז`, kind: "CENTER" } });
  const d1 = await prisma.orgNode.create({ data: { name: `${TAG} תחום 1`, kind: "DOMAIN", parentId: center.id } });
  const d2 = await prisma.orgNode.create({ data: { name: `${TAG} תחום 2`, kind: "DOMAIN", parentId: center.id } });
  const s1 = await prisma.orgNode.create({ data: { name: `${TAG} מדור 1`, kind: "SECTION", parentId: d1.id } });
  const s2 = await prisma.orgNode.create({ data: { name: `${TAG} מדור 2`, kind: "SECTION", parentId: d1.id } });
  const t1 = await prisma.orgNode.create({ data: { name: `${TAG} צוות 1`, kind: "TEAM", parentId: s1.id } });
  return { center: center.id, d1: d1.id, d2: d2.id, s1: s1.id, s2: s2.id, t1: t1.id };
}

/**
 * Free a framework so a later section can appoint to it.
 *
 * Explicit rather than folded into mkUser: the unique index refusing a second
 * commander is the feature working, and a fixture helper that silently swept it
 * aside would be able to hide a real regression.
 */
async function releaseCommand(nodeId: string) {
  await prisma.user.updateMany({ where: { commandsNodeId: nodeId }, data: { commandsNodeId: null } });
}

async function mkUser(handle: string, commandsNodeId: string | null, role: "ADMIN" | "MANAGER" = "MANAGER") {
  const u = await prisma.user.create({
    data: {
      name: `${TAG}-${handle}`, email: `${handle}${MAIL}`, username: `${TAG}-${handle}`,
      passwordHash: hashPassword("x"), role, commandsNodeId,
    },
  });
  return u;
}

async function mkQuery(senderNodeId: string, targets: string[], dueDate: Date, authorId?: string) {
  return prisma.query.create({
    data: {
      senderNodeId, authorId, title: `${TAG} כותרת`, body: "גוף", dueDate,
      targets: { create: targets.map((nodeId) => ({ nodeId })) },
    },
    include: { targets: true },
  });
}

/**
 * 1 — who may send and who may receive.
 *
 * Receiving flipped when recipients became chosen: it used to exclude the
 * center ("nobody above"), and now ANY commander may be addressed, from any
 * direction. Sending did not flip — a team still only answers.
 */
function capability() {
  console.log("\n=== who may send ===");
  // Receiving has no predicate to test: it follows from being commanded, and
  // `recipientRules` below proves it against real frameworks — including a
  // center, addressed from beneath it. A tautological `canReceiveAt(kind)`
  // check used to stand here and could only ever agree with itself.
  check("a center commander sends", canSendFrom("CENTER"));
  check("a team commander has nobody below to send to", !canSendFrom("TEAM"));
  for (const k of ["DOMAIN", "SECTION"] as const) {
    check(`a ${k} commander sends`, canSendFrom(k));
  }
}

/** 1b — who may be a recipient of whose query. */
async function recipientRules(f: Fx) {
  console.log("\n=== a recipient is a child, or a commanded framework anywhere ===");
  for (const n of [f.center, f.d2]) await releaseCommand(n);

  check("a direct child qualifies even with NO commander", await validRecipient(f.d1, f.s1),
    "the empty row tells the sender someone needs appointing");
  check("an uncommanded framework elsewhere does NOT", !(await validRecipient(f.d1, f.d2)),
    "a dead letter nobody could answer");
  const boss = await mkUser("crossboss", f.d2);
  check("commanding it makes it addressable from anywhere", await validRecipient(f.d1, f.d2));
  check("including from below — a section may address a domain", await validRecipient(f.s1, f.d2));
  check("a framework that does not exist never qualifies", !(await validRecipient(f.d1, "no-such-node")));

  // the rank rule the removed predicate used to assert, tested for real: a
  // center is addressable once commanded, including from a section below it
  const top = await mkUser("centerboss", f.center);
  check("a commanded CENTER is a valid recipient", await validRecipient(f.d1, f.center));
  check("including from a section beneath it", await validRecipient(f.s1, f.center));
  await prisma.user.delete({ where: { id: top.id } });
  check("and stops qualifying the moment nobody commands it", !(await validRecipient(f.d1, f.center)));

  const offered = await commandedFrameworks();
  check("the ‎@‎ list offers exactly the commanded frameworks", offered.some((o) => o.nodeId === f.d2));
  check("and none of the uncommanded ones", !offered.some((o) => o.nodeId === f.center));
  check("labelled by full path", offered.every((o) => o.commander && (o.path.includes("▸") || o.kind === "CENTER")));
  await prisma.user.delete({ where: { id: boss.id } });
}

/** 2 — recipients are exactly one level down. */
async function recipients(f: Fx) {
  console.log("\n=== recipients are exactly one level down ===");
  const fromCenter = await recipientsOf(f.center);
  check("a center reaches its domains", fromCenter.map((r) => r.nodeId).sort().join() === [f.d1, f.d2].sort().join(),
    `${fromCenter.length} recipients`);
  check("and NOT the sections two levels down", !fromCenter.some((r) => r.nodeId === f.s1 || r.nodeId === f.s2));

  const fromD1 = await recipientsOf(f.d1);
  check("a domain reaches its own sections", fromD1.map((r) => r.nodeId).sort().join() === [f.s1, f.s2].sort().join());
  check("and not another domain's", !fromD1.some((r) => r.nodeId === f.d2));

  check("a team reaches nobody", (await recipientsOf(f.t1)).length === 0);
  check("recipients are labelled by full path", fromD1.every((r) => r.path.includes("▸")), fromD1[0]?.path ?? "");

  await mkUser("sectioncmd", f.s1);
  const withCmd = await recipientsOf(f.d1);
  check("a framework with a commander carries them", withCmd.find((r) => r.nodeId === f.s1)?.commander?.name === `${TAG}-sectioncmd`);
  check("a framework without one carries null — the row nobody can fill",
    withCmd.find((r) => r.nodeId === f.s2)?.commander === null);
}

/** 3 — openness is derived, and survives a deadline moving both ways. */
function derived() {
  console.log("\n=== openness is derived from the deadline ===");
  const due = day("2026-08-10");
  check("open the day before", isOpen({ dueDate: due }, at("2026-08-09", 12)));
  check("open ON the due date — the deadline is inclusive", isOpen({ dueDate: due }, at("2026-08-10", 12)));
  check("open at 23:00 on the due date", isOpen({ dueDate: due }, at("2026-08-10", 23)));
  check("closed the next day", !isOpen({ dueDate: due }, at("2026-08-11", 0)));

  // the off-by-a-day this app is prone to: the server runs at UTC+3, so at
  // 01:00 local the UTC date is still yesterday
  const oneAm = new Date("2026-08-11T01:00:00+03:00");
  check("closed at 01:00 local on the day after — not still open on UTC's yesterday", !isOpen({ dueDate: due }, oneAm),
    `local date ${oneAm.getDate()}, UTC date ${oneAm.getUTCDate()}`);
  check("todayMarker follows the LOCAL calendar day", todayMarker(oneAm).getTime() === day("2026-08-11").getTime());

  // moving the deadline is the only state transition there is
  check("a passed deadline reopens by moving it forward", isOpen({ dueDate: day("2026-08-20") }, at("2026-08-15", 9)));
  check("and closes by moving it backward", !isOpen({ dueDate: day("2026-08-01") }, at("2026-08-15", 9)));

  // an early close is the second fact, and it overrides a deadline still ahead
  check("a future deadline is open", isOpen({ dueDate: day("2026-08-20"), closedAt: null }, at("2026-08-15", 9)));
  check("and shut once the sender closed it early",
    !isOpen({ dueDate: day("2026-08-20"), closedAt: new Date("2026-08-15T10:00:00Z") }, at("2026-08-15", 9)));
  check("reopening restores whatever the deadline says",
    isOpen({ dueDate: day("2026-08-20"), closedAt: null }, at("2026-08-16", 9)));
  check("but reopening does NOT resurrect a deadline that has itself passed",
    !isOpen({ dueDate: day("2026-08-10"), closedAt: null }, at("2026-08-16", 9)));
}

/** 4 — the audience is closed. */
async function audience(f: Fx) {
  console.log("\n=== only the sender and the target ===");
  const q = await mkQuery(f.d1, [f.s1, f.s2], day("2026-12-31"));
  const view = { senderNodeId: q.senderNodeId, targets: q.targets.map((t) => ({ nodeId: t.nodeId })) };

  check("the sending framework's commander reads it", mayRead({ commandsNodeId: f.d1 }, view));
  check("an addressed framework's commander reads it", mayRead({ commandsNodeId: f.s1 }, view));
  check("a SIBLING target reads it too — it was addressed to them as well", mayRead({ commandsNodeId: f.s2 }, view));
  check("the level ABOVE the sender does not", !mayRead({ commandsNodeId: f.center }, view));
  check("a framework below a target does not", !mayRead({ commandsNodeId: f.t1 }, view));
  check("an unrelated framework does not", !mayRead({ commandsNodeId: f.d2 }, view));
  check("a user who commands nothing does not", !mayRead({ commandsNodeId: null }, view));

  // the Admin has no exception — the point of the rule
  const admin = await mkUser("admin", null, "ADMIN");
  check("the ADMIN, commanding nothing, does not", !mayRead({ commandsNodeId: admin.commandsNodeId }, view));
  const adminCmd = await mkUser("admincmd", f.d2, "ADMIN");
  check("nor an Admin who commands an unrelated framework", !mayRead({ commandsNodeId: adminCmd.commandsNodeId }, view));

  // answering is narrower still than reading
  check("a sibling may READ but not ANSWER for another framework",
    !mayAnswer({ commandsNodeId: f.s2 }, q, { nodeId: f.s1 }, at("2026-08-05", 12)));
  check("a target answers its own row", mayAnswer({ commandsNodeId: f.s1 }, q, { nodeId: f.s1 }, at("2026-08-05", 12)));
  check("the sender cannot answer on a target's behalf",
    !mayAnswer({ commandsNodeId: f.d1 }, q, { nodeId: f.s1 }, at("2026-08-05", 12)));
  check("nobody may answer once closed",
    !mayAnswer({ commandsNodeId: f.s1 }, { dueDate: day("2026-01-01") }, { nodeId: f.s1 }, at("2026-08-05", 12)));
  check("nor once the sender closed it early, deadline notwithstanding",
    !mayAnswer({ commandsNodeId: f.s1 }, { dueDate: day("2026-12-31"), closedAt: new Date() }, { nodeId: f.s1 }, at("2026-08-05", 12)));
}

/** 5 — both ends anchored to frameworks. */
async function anchoring(f: Fx) {
  console.log("\n=== replacing a commander orphans nothing ===");
  for (const n of [f.d1, f.s1, f.s2]) await releaseCommand(n);
  const first = await mkUser("first", f.s1);
  const q = await mkQuery(f.d1, [f.s1], day("2026-12-31"));
  const view = { senderNodeId: q.senderNodeId, targets: q.targets.map((t) => ({ nodeId: t.nodeId })) };
  check("the commander at the time can read it", mayRead({ commandsNodeId: first.commandsNodeId }, view));

  // replaced mid-query: clear, then appoint someone else to the SAME framework
  await prisma.user.update({ where: { id: first.id }, data: { commandsNodeId: null } });
  const second = await mkUser("second", f.s1);
  check("the replacement inherits it", mayRead({ commandsNodeId: second.commandsNodeId }, view));
  check("and the person replaced loses it",
    !mayRead({ commandsNodeId: (await prisma.user.findUniqueOrThrow({ where: { id: first.id } })).commandsNodeId }, view));
  check("the query itself never moved", (await prisma.query.findUniqueOrThrow({ where: { id: q.id } })).senderNodeId === f.d1);

  // appointed AFTER the query was sent, to a framework that had nobody
  const q2 = await mkQuery(f.d1, [f.s2], day("2026-12-31"));
  const view2 = { senderNodeId: q2.senderNodeId, targets: q2.targets.map((t) => ({ nodeId: t.nodeId })) };
  const late = await mkUser("late", f.s2);
  check("a commander appointed after the send inherits the waiting query", mayRead({ commandsNodeId: late.commandsNodeId }, view2));

  // the SENDING end, replaced
  const sender = await mkUser("sender", f.d1);
  check("the sending framework's new commander sees what it sent", mayRead({ commandsNodeId: sender.commandsNodeId }, view));
  check("including answers received", (await prisma.query.findUniqueOrThrow({ where: { id: q.id }, include: { targets: true } })).targets.length === 1);

  // command cleared before answering
  await prisma.user.update({ where: { id: second.id }, data: { commandsNodeId: null } });
  check("a commander whose command was cleared can no longer read it",
    !mayRead({ commandsNodeId: (await prisma.user.findUniqueOrThrow({ where: { id: second.id } })).commandsNodeId }, view));
  check("and the target row is still waiting for whoever comes next",
    (await prisma.queryTarget.findFirstOrThrow({ where: { queryId: q.id } })).answer === null);
}

/** 6 — the outstanding counter. */
async function counter(f: Fx) {
  console.log("\n=== the outstanding counter ===");
  const now = at("2026-08-05", 12);
  // Start from nothing: earlier sections left open queries pointed at this same
  // framework, and a count is only meaningful against a known baseline.
  await prisma.query.deleteMany({ where: { title: { startsWith: TAG } } });
  await releaseCommand(f.s1);
  const cmd = await mkUser("counted", f.s1);
  await mkQuery(f.d1, [f.s1], day("2026-08-20"));
  await mkQuery(f.d1, [f.s1], day("2026-08-25"));
  check("two open queries await them", (await outstandingCount(cmd.commandsNodeId, now)) === 2,
    String(await outstandingCount(cmd.commandsNodeId, now)));

  await prisma.queryTarget.updateMany({
    where: { nodeId: f.s1, query: { dueDate: day("2026-08-20") } },
    data: { answer: "עניתי", answeredAt: new Date() },
  });
  check("answering one clears it from the count", (await outstandingCount(cmd.commandsNodeId, now)) === 1);

  await mkQuery(f.d1, [f.s1], day("2026-01-01"));
  check("a query whose deadline passed does not nag", (await outstandingCount(cmd.commandsNodeId, now)) === 1,
    "closed queries are not outstanding");
  check("someone who commands nothing has no count", (await outstandingCount(null, now)) === 0);
}

/**
 * 7 — the agent snapshot carries a SECOND scope, and it is genuinely narrower.
 *
 * The trap this guards: career visibility is subtree-shaped, so a center
 * commander with a grant on the center can see every framework beneath it. If
 * queries were clipped by that same visibility, they would read every exchange
 * in the org. They are clipped by the command chain instead, and the difference
 * has to be demonstrated on data where the two would disagree.
 */
async function agentScope(f: Fx) {
  console.log("\n=== the agent's second scope axis ===");
  const { exportScopedSnapshot, removeSnapshot } = await import("@/lib/agent-snapshot");
  const { computeVisibility } = await import("@/lib/access");
  const { readFile } = await import("fs/promises");

  await prisma.query.deleteMany({ where: { title: { startsWith: TAG } } });
  for (const n of [f.center, f.d1, f.s1]) await releaseCommand(n);

  // the center commander can SEE the whole tree — grant on the center itself
  const boss = await mkUser("boss", f.center);
  await prisma.accessGrant.create({ data: { userId: boss.id, nodeId: f.center, level: "EDIT" } });

  // their own query, downward
  const own = await prisma.query.create({
    data: { senderNodeId: f.center, authorId: boss.id, title: `${TAG} שאילתה משלי`, body: "גוף",
      dueDate: day("2026-12-31"), targets: { create: [{ nodeId: f.d1 }] } },
  });
  await prisma.queryTarget.updateMany({ where: { queryId: own.id }, data: { answer: "תשובת התחום", answeredAt: new Date() } });

  // an exchange one level DOWN, between two frameworks the boss can see but is not party to
  await prisma.query.create({
    data: { senderNodeId: f.d1, title: `${TAG} שאילתה זרה`, body: "לא ענייני",
      dueDate: day("2026-12-31"), targets: { create: [{ nodeId: f.s1, answer: "תשובה זרה מאוד" }] } },
  });

  const vis = await computeVisibility({ id: boss.id, name: boss.name, role: boss.role, grants: [{ nodeId: f.center, level: "EDIT" }] });
  check("career visibility DOES cover both frameworks in the other exchange",
    vis.nodeIds.has(f.d1) && vis.nodeIds.has(f.s1), "so the two scopes genuinely disagree here");

  const dir = await exportScopedSnapshot(vis, new Date("2026-08-05T00:00:00Z"), boss.id);
  try {
    const json = await readFile(`${dir}/queries.json`, "utf8");
    check("the snapshot carries the user's own query", json.includes(`${TAG} שאילתה משלי`));
    check("with the answer it received", json.includes("תשובת התחום"));
    check("and NOT the exchange between the two frameworks below", !json.includes(`${TAG} שאילתה זרה`),
      !json.includes(`${TAG} שאילתה זרה`) ? "absent, as it must be" : "LEAKED INTO THE SNAPSHOT");
    check("nor its answer text", !json.includes("תשובה זרה מאוד"));

    const readme = await readFile(`${dir}/README.md`, "utf8");
    check("and the README tells the agent the two scopes differ", readme.includes("נחתך אחרת"));
  } finally {
    await removeSnapshot(dir);
  }

  // a user who commands nothing gets an empty file rather than a missing one
  const plain = await mkUser("plain", null);
  const dir2 = await exportScopedSnapshot(vis, new Date("2026-08-05T00:00:00Z"), plain.id);
  try {
    const json = await readFile(`${dir2}/queries.json`, "utf8");
    check("a non-commander gets an empty queries file, not a missing one", json.includes("[]") && !json.includes(TAG));
  } finally {
    await removeSnapshot(dir2);
  }
}

/**
 * 8 — tagging a person.
 *
 * The id is the reference and the label is only a convenience, so the tests
 * that matter are the ones where the two disagree: a person renamed after being
 * tagged, and a person deleted after being tagged.
 */
async function mentions(f: Fx) {
  console.log("\n=== tagging a person ===");
  const { parseMentions, mentionedIds, stripMentions, mentionToken } = await import("@/lib/mentions");

  const tok = mentionToken("abc123", "דנה כהן");
  check("a tag carries the id, not just the name", tok === "@[דנה כהן](abc123)", tok);

  const text = `נא לעדכן על ${mentionToken("p1", "דנה כהן")} ועל ${mentionToken("p2", "יוסי לוי")}.`;
  const spans = parseMentions(text);
  check("the sentence survives the parse",
    spans.map((s) => (s.kind === "text" ? s.text : `@${s.label}`)).join("") === "נא לעדכן על @דנה כהן ועל @יוסי לוי.");
  check("both people are found", mentionedIds(text).sort().join() === "p1,p2");
  check("tags flatten to plain text for mail and the agent",
    stripMentions(text) === "נא לעדכן על @דנה כהן ועל @יוסי לוי.");

  // things that must NOT be read as tags
  check("a bare @name is not a tag", parseMentions("שלח ל@דנה").every((s) => s.kind === "text"));
  check("an email address is not a tag", mentionedIds("כתוב ל dana@example.com").length === 0);
  check("markdown links are not tags", mentionedIds("[ראה כאן](https://example.com)").length === 0);
  check("a tag with a newline in the label is not parsed", mentionedIds("@[דנה\nכהן](p1)").length === 0);
  check("text with no tags is returned whole",
    parseMentions("אין כאן תיוגים").length === 1 && stripMentions("אין כאן תיוגים") === "אין כאן תיוגים");

  // the id is the truth: rename and deletion
  const team = await prisma.orgNode.findFirstOrThrow({ where: { id: f.t1 } });
  const person = await prisma.person.create({
    data: {
      firstName: TAG, lastName: "לפני", fullName: `${TAG} לפני`,
      recruitmentDate: day("2020-01-01"), placementDate: day("2020-01-01"), teamId: team.id,
    },
  });
  const tagged = `דווח על ${mentionToken(person.id, `${TAG} לפני`)}`;

  await prisma.person.update({ where: { id: person.id }, data: { lastName: "אחרי", fullName: `${TAG} אחרי` } });
  const fresh = await prisma.person.findUniqueOrThrow({ where: { id: person.id }, select: { fullName: true } });
  check("after a rename the id still resolves", fresh.fullName === `${TAG} אחרי`, fresh.fullName);
  check("while the stored label is the OLD name — which is why rendering re-resolves",
    parseMentions(tagged).some((s) => s.kind === "mention" && s.label === `${TAG} לפני`));

  await prisma.person.delete({ where: { id: person.id } });
  const gone = await prisma.person.findUnique({ where: { id: person.id } });
  check("after a deletion the id resolves to nothing", gone === null);
  check("and the stored label keeps the sentence readable",
    stripMentions(tagged) === `דווח על @${TAG} לפני`, stripMentions(tagged));
}

/**
 * 9 — deleting a query, and the asker's side of the badge.
 */
async function deletionAndBadge(f: Fx) {
  console.log("\n=== deleting a query ===");
  await prisma.query.deleteMany({ where: { title: { startsWith: TAG } } });
  for (const n of [f.d1, f.s1, f.s2]) await releaseCommand(n);

  const q = await mkQuery(f.d1, [f.s1, f.s2], day("2026-12-31"));
  await prisma.queryTarget.updateMany({ where: { queryId: q.id, nodeId: f.s1 }, data: { answer: "תשובה", answeredAt: new Date() } });
  const targetIds = q.targets.map((t) => t.id);

  await prisma.query.delete({ where: { id: q.id } });
  check("the query is gone", (await prisma.query.count({ where: { id: q.id } })) === 0);
  check("and EVERY recipient's copy went with it — no orphan rows",
    (await prisma.queryTarget.count({ where: { id: { in: targetIds } } })) === 0);
  check("including the one that had already answered",
    (await prisma.queryTarget.count({ where: { queryId: q.id } })) === 0);
  check("the frameworks themselves are untouched",
    (await prisma.orgNode.count({ where: { id: { in: [f.d1, f.s1, f.s2] } } })) === 3);

  console.log("\n=== the asker's half of the badge ===");
  const asker = await mkUser("asker", f.d1);
  const answerer = await mkUser("answerer", f.s1);
  const q2 = await mkQuery(f.d1, [f.s1], day("2026-12-31"));
  const now = at("2026-08-05", 12);

  let b = await queryBadge(asker.commandsNodeId, now);
  check("nothing to read before anyone answers", b.newAnswers === 0 && b.total === 0, JSON.stringify(b));
  b = await queryBadge(answerer.commandsNodeId, now);
  check("while the answerer is told one awaits them", b.awaitingMyAnswer === 1 && b.total === 1, JSON.stringify(b));

  const t = await prisma.queryTarget.findFirstOrThrow({ where: { queryId: q2.id } });
  await prisma.queryTarget.update({ where: { id: t.id }, data: { answer: "עניתי", answeredAt: new Date(), seenBySender: false } });
  b = await queryBadge(asker.commandsNodeId, now);
  check("an answer shows up on the ASKER's badge", b.newAnswers === 1 && b.total === 1, JSON.stringify(b));
  check("and the answerer's own count clears", (await queryBadge(answerer.commandsNodeId, now)).total === 0);

  await prisma.queryTarget.update({ where: { id: t.id }, data: { seenBySender: true } });
  check("reading it clears the asker's badge", (await queryBadge(asker.commandsNodeId, now)).total === 0);

  await prisma.queryTarget.update({ where: { id: t.id }, data: { answer: "תיקנתי", updatedAt: new Date(), seenBySender: false } });
  check("a REVISION is news again", (await queryBadge(asker.commandsNodeId, now)).newAnswers === 1);

  // the two halves are separate numbers that happen to share an icon
  const both = await mkQuery(f.d1, [f.s1], day("2026-12-30"));
  await prisma.queryTarget.updateMany({ where: { queryId: both.id }, data: { answer: null } });
  const askerBadge = await queryBadge(asker.commandsNodeId, now);
  check("the asker is not counted as owing themselves an answer", askerBadge.awaitingMyAnswer === 0, JSON.stringify(askerBadge));
  const answererBadge = await queryBadge(answerer.commandsNodeId, now);
  check("and the two meanings stay separable", answererBadge.awaitingMyAnswer === 1 && answererBadge.newAnswers === 0,
    JSON.stringify(answererBadge));
  check("someone commanding nothing has neither", (await queryBadge(null, now)).total === 0);
}

async function main() {
  await cleanup();
  const f = await scaffold();
  try {
    capability();
    await recipientRules(f);
    await recipients(f);
    derived();
    await audience(f);
    await anchoring(f);
    await counter(f);
    await agentScope(f);
    await mentions(f);
    await deletionAndBadge(f);
  } finally {
    await cleanup();
    const users = await prisma.user.count({ where: { email: { endsWith: MAIL } } });
    const nodes = await prisma.orgNode.count({ where: { name: { startsWith: TAG } } });
    const queries = await prisma.query.count({ where: { title: { startsWith: TAG } } });
    check("no fixtures left behind", users === 0 && nodes === 0 && queries === 0,
      `${users} users, ${nodes} frameworks, ${queries} queries`);
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
  await cleanup().catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
