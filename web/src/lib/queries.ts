import type { OrgKind, QuerySenderKind } from "@/generated/prisma/client";
import { computeVisibility, type SessionUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { todayMarker } from "@/lib/dates";
import { pathResolver } from "@/lib/commander";
import { visibilityFrom } from "@/lib/access";

/**
 * Commander queries — the rules of who may ask, who must answer, and who sees.
 *
 * A query between frameworks reads the command chain and nothing else — its
 * audience is decided by rank, not by visibility.
 *
 * There is now a second kind of correspondent: an HR person (משא״ן), who is
 * outside the chain and whose reach IS decided by their access grants. That is
 * the one place the two axes meet, and it is deliberate rather than quiet: it
 * is confined to `lateralRecipients` / `validLateralRecipient`, it never widens
 * who may READ a query, and it never writes a grant. The chain rules below —
 * `canSendFrom`, `recipientsOf`, `validRecipient` — are untouched by it.
 *
 * Openness is derived from two facts, never cached: the deadline, and whether
 * the sender ended it early. See `isOpen`.
 */

/** A commander of a TEAM has nobody below, so the lowest level only answers. */
export function canSendFrom(kind: OrgKind): boolean {
  return kind !== "TEAM";
}

/**
 * There is deliberately NO `canReceiveAt`. Receiving used to exclude the center
 * — reasoned from "nobody is above them" — but recipients are chosen now and may
 * come from any direction, so being addressable follows from being commanded,
 * not from rank. A predicate that always returned true only invited someone to
 * restore a condition that was removed on purpose; the for-me panel is simply
 * always present. Sending is a different question, and still refuses teams.
 */

/**
 * Open through the END of the due date, unless the sender ended it early.
 *
 *     open  ⟺  closedAt is null  AND  today ≤ dueDate
 *
 * The date comparison is between UTC-midnight day markers, so it is a
 * comparison of calendar days: a query due 31/12 is answerable all through
 * 31/12 and shut on 01/01. A date is a day, not an instant — the rule the whole
 * system uses.
 *
 * Takes the query rather than a bare date so that no caller can accidentally
 * ask half the question. Every "is this open?" in the app goes through here.
 */
export function isOpen(query: { dueDate: Date; closedAt?: Date | null }, now: Date = new Date()): boolean {
  if (query.closedAt) return false;
  return todayMarker(now).getTime() <= query.dueDate.getTime();
}

export type Recipient = {
  nodeId: string;
  name: string;
  path: string;
  kind: OrgKind;
  /** null when nobody commands this framework — a row nobody can fill */
  commander: { id: string; name: string; email: string } | null;
};

/**
 * The frameworks exactly one level below, with whoever commands each.
 *
 * One definition, used by the send action, the page and the reminder alike: if
 * these three ever disagreed about who a query is for, the disagreement would
 * show up as mail sent to someone who cannot see the query.
 */
export async function recipientsOf(nodeId: string): Promise<Recipient[]> {
  const [nodes, children] = await Promise.all([
    prisma.orgNode.findMany(),
    prisma.orgNode.findMany({
      where: { parentId: nodeId },
      include: { commander: { select: { id: true, name: true, email: true } } },
    }),
  ]);
  const resolve = pathResolver(nodes);
  return children
    .map((c) => ({
      nodeId: c.id,
      name: c.name,
      path: resolve(c.id),
      kind: c.kind,
      commander: c.commander ?? null,
    }))
    .sort((a, b) => a.path.localeCompare(b.path, "he"));
}

/**
 * Every framework that currently has a commander — what the ‎@‎ picker offers.
 *
 * Only commanded ones: the level-below checklist keeps showing uncommanded
 * children as "אין מפקד" rows because there the absence is information, but an
 * EXPLICITLY added target nobody can answer would just be a dead letter.
 */
export async function commandedFrameworks(): Promise<Recipient[]> {
  const nodes = await prisma.orgNode.findMany({
    include: { commander: { select: { id: true, name: true, email: true } } },
  });
  const resolve = pathResolver(nodes);
  return nodes
    .filter((n) => n.commander)
    .map((n) => ({ nodeId: n.id, name: n.name, path: resolve(n.id), kind: n.kind, commander: n.commander! }))
    .sort((a, b) => a.path.localeCompare(b.path, "he"));
}


/**
 * Is this user the sender of this query?
 *
 * ONE definition, because there used to be eight: every guard in
 * `query-actions.ts` wrote `query.senderNodeId !== me.commandsNodeId` for
 * itself. That is exactly right while every sender is a framework, and exactly
 * one edit away from being wrong in one of eight places once a sender can also
 * be a person — silently, because the eighth would simply let the wrong user
 * close someone else's query.
 *
 * FRAMEWORK: whoever commands the sending framework right now, so a query
 * outlives the commander who wrote it.
 * STAFF: the author, and only the author. There is no framework carrying it,
 * which is the whole point — the commander of the node an HR user was granted
 * over is a stranger to their correspondence.
 */
export function isSenderOf(
  user: { id: string; commandsNodeId: string | null },
  query: { senderKind: QuerySenderKind; senderNodeId: string; authorId: string | null },
): boolean {
  if (query.senderKind === "STAFF") return !!query.authorId && query.authorId === user.id;
  return !!user.commandsNodeId && query.senderNodeId === user.commandsNodeId;
}

/**
 * Every commanded framework inside the subtrees this user is granted over —
 * what an HR user may address.
 *
 * Lateral, not down a chain: any depth, and the granted node itself is
 * included, because an HR person talks to the commanders *in* their framework
 * rather than to the level beneath them. Several grants union into one list.
 *
 * Uncommanded frameworks are omitted, unlike `recipientsOf`, which keeps them
 * as "אין מפקד" rows. There the absence is information a superior can act on;
 * here the sender is outside the chain and can appoint nobody, so the row would
 * only be a target that can never answer.
 */
export async function lateralRecipients(user: SessionUser): Promise<Recipient[]> {
  const visibility = await computeVisibility(user);
  const nodes = await prisma.orgNode.findMany({
    include: { commander: { select: { id: true, name: true, email: true } } },
  });
  const resolve = pathResolver(nodes);
  return nodes
    .filter((n) => n.commander && visibility.nodeIds.has(n.id))
    .map((n) => ({ nodeId: n.id, name: n.name, path: resolve(n.id), kind: n.kind, commander: n.commander! }))
    .sort((a, b) => a.path.localeCompare(b.path, "he"));
}

/**
 * Which granted framework a lateral request was made under.
 *
 * The column is NOT NULL and its cascade is meaningful — dissolve the framework
 * the request was made under and the request goes with it — but for a STAFF
 * query it is an audit fact only: ownership is the author, and the from-line
 * never renders it.
 *
 * Preference is the widest grant that contains EVERY recipient, which is the
 * honest answer whenever one exists. With disjoint grants and recipients spread
 * across them no single node is the truth; the first recipient's grant is
 * recorded, and that arbitrariness is confined here rather than being an
 * ambiguity the sender is asked to resolve.
 */
export async function lateralScope(user: SessionUser, recipientIds: string[]): Promise<string> {
  const nodes = await prisma.orgNode.findMany({ select: { id: true, parentId: true } });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const ancestorsOf = (id: string): Set<string> => {
    const out = new Set<string>();
    let cur = byId.get(id);
    while (cur) {
      out.add(cur.id);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return out;
  };
  const depthOf = (id: string) => ancestorsOf(id).size;
  const grantNodes = [...new Set(user.grants.map((g) => g.nodeId))].filter((id) => byId.has(id));
  const chains = recipientIds.map(ancestorsOf);

  const coversAll = grantNodes.filter((g) => chains.every((c) => c.has(g)));
  const pool = coversAll.length > 0 ? coversAll : grantNodes.filter((g) => chains[0]?.has(g));
  const chosen = pool.sort((a, b) => depthOf(a) - depthOf(b))[0];
  if (!chosen) throw new Error("לא נמצאה מסגרת מוקצית שהנמענים נמצאים בתוכה.");
  return chosen;
}

/**
 * May this user address this framework laterally? The rule the ACTION enforces;
 * `lateralRecipients` is the same rule shaped for a chooser.
 */
export async function validLateralRecipient(user: SessionUser, nodeId: string): Promise<boolean> {
  const [visibility, node] = await Promise.all([
    computeVisibility(user),
    prisma.orgNode.findUnique({ where: { id: nodeId }, select: { commander: { select: { id: true } } } }),
  ]);
  return !!node?.commander && visibility.nodeIds.has(nodeId);
}

/**
 * May this framework be a recipient of a query from `senderNodeId`?
 *
 * Two doors in: a DIRECT CHILD (the default audience — commanded or not, since
 * an empty child row tells the sender someone needs appointing), or any
 * COMMANDED framework anywhere (the ‎@‎ route). Checked by the action, not only
 * offered by the form: the form is a convenience, this is the rule.
 */
export async function validRecipient(senderNodeId: string, nodeId: string): Promise<boolean> {
  const node = await prisma.orgNode.findUnique({
    where: { id: nodeId },
    select: { parentId: true, commander: { select: { id: true } } },
  });
  if (!node) return false;
  return node.parentId === senderNodeId || !!node.commander;
}

export type HrRecipient = { userId: string; name: string; email: string };

/**
 * The HR users a commander of `senderNodeId` may address: role HR, holding an
 * EDIT grant that covers the framework.
 *
 * Coverage goes through `visibilityFrom` — the same function that answers every
 * other coverage question — so inheritance comes free: an edit grant on the
 * section qualifies its teams. View does not qualify (the tender of people
 * edits them), and a MANAGER with edit does not qualify (the channel is to the
 * HR role, not to anyone who can type).
 */
export async function eligibleHr(senderNodeId: string): Promise<HrRecipient[]> {
  const [nodes, hrUsers] = await Promise.all([
    prisma.orgNode.findMany(),
    prisma.user.findMany({ where: { role: "HR" }, select: { id: true, name: true, email: true, grants: { select: { nodeId: true, level: true } } } }),
  ]);
  return hrUsers
    .filter((u) => visibilityFrom(nodes, { id: u.id, name: u.name, role: "HR", grants: u.grants }).canEdit(senderNodeId))
    .map((u) => ({ userId: u.id, name: u.name, email: u.email }))
    .sort((a, b) => a.name.localeCompare(b.name, "he"));
}

/**
 * May any commander address HR? Yes — including a TEAM commander, for whom this
 * is the only way to send. `canSendFrom` keeps answering the narrower question
 * ("may they address FRAMEWORKS"), which still excludes teams.
 */
export function maySendToHr(commandsNodeId: string | null): boolean {
  return !!commandsNodeId;
}

/**
 * May this user read this query?
 *
 * The whole rule, with no exceptions — not for the level above, and not for the
 * Admin, on the same footing as the private rules page. Written as one function
 * because it will come under pressure: somebody will eventually want a report
 * that crosses it, and that should be a decision, not a leak.
 */
export function mayRead(
  user: { id: string; commandsNodeId: string | null },
  query: { senderKind: QuerySenderKind; senderNodeId: string; authorId: string | null; targets: { nodeId: string | null; targetUserId?: string | null }[] },
): boolean {
  // the sending side goes through the one ownership definition
  if (isSenderOf(user, query)) return true;
  // the receiving side: whoever commands an addressed framework — or IS an
  // addressed person. A person-target belongs to its user, wherever they sit.
  if (query.targets.some((t) => t.targetUserId === user.id)) return true;
  const mine = user.commandsNodeId;
  return !!mine && query.targets.some((t) => !!t.nodeId && t.nodeId === mine);
}

/**
 * May this user ANSWER this target row?
 *
 * A framework row belongs to whoever commands the framework NOW; a person row
 * belongs to its person and nobody else — not even a commander whose framework
 * the person tends. Both require the query to still be open.
 */
export function mayAnswer(
  user: { id: string; commandsNodeId: string | null },
  query: { dueDate: Date; closedAt?: Date | null },
  target: { nodeId: string | null; targetUserId?: string | null },
  now: Date = new Date(),
): boolean {
  if (!isOpen(query, now)) return false;
  if (target.targetUserId) return target.targetUserId === user.id;
  return !!user.commandsNodeId && user.commandsNodeId === target.nodeId;
}

/**
 * What the header badge is counting, split so it can be explained.
 *
 * Two different things land on one icon, and a bare number would be ambiguous:
 * queries waiting for MY answer, and answers to MY queries that I have not read
 * yet. The badge shows the sum and its tooltip names the parts.
 *
 * Note the asymmetry, which is correct: waiting-for-my-answer is derived (an
 * open query with no answer), while unread-answer is stored, because "new since
 * I last looked" is a fact about the reader that no timestamp on the answer can
 * supply.
 */
export type QueryBadge = { awaitingMyAnswer: number; newAnswers: number; total: number };

export async function queryBadge(
  commandsNodeId: string | null,
  /** set for a lateral correspondent (משא״ן): they own queries as a person */
  staffUserId: string | null = null,
  now: Date = new Date(),
): Promise<QueryBadge> {
  // A lateral correspondent owns queries as a person — and, now that a person
  // can be ADDRESSED, may also owe answers as one.
  if (staffUserId) {
    const [newAnswers, awaitingMyAnswer] = await Promise.all([
      prisma.queryTarget.count({
        where: { query: { senderKind: "STAFF", authorId: staffUserId }, answer: { not: null }, seenBySender: false },
      }),
      prisma.queryTarget.count({
        where: { targetUserId: staffUserId, answer: null, query: { closedAt: null, dueDate: { gte: todayMarker(now) } } },
      }),
    ]);
    return { awaitingMyAnswer, newAnswers, total: awaitingMyAnswer + newAnswers };
  }
  if (!commandsNodeId) return { awaitingMyAnswer: 0, newAnswers: 0, total: 0 };
  const [awaitingMyAnswer, newAnswers] = await Promise.all([
    prisma.queryTarget.count({
      where: { nodeId: commandsNodeId, answer: null, query: { closedAt: null, dueDate: { gte: todayMarker(now) } } },
    }),
    prisma.queryTarget.count({
      // senderKind matters: a lateral query records the framework it was made
      // under, and without this the commander of that framework would be
      // notified about answers to correspondence that is not theirs
      where: {
        query: { senderKind: "FRAMEWORK", senderNodeId: commandsNodeId },
        answer: { not: null },
        seenBySender: false,
      },
    }),
  ]);
  return { awaitingMyAnswer, newAnswers, total: awaitingMyAnswer + newAnswers };
}

/** How many queries await an answer from this user right now. */
export async function outstandingCount(commandsNodeId: string | null, now: Date = new Date()): Promise<number> {
  return (await queryBadge(commandsNodeId, null, now)).awaitingMyAnswer;
}
