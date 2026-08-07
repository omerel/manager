import type { OrgKind } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { todayMarker } from "@/lib/dates";
import { pathResolver } from "@/lib/commander";

/**
 * Commander queries — the rules of who may ask, who must answer, and who sees.
 *
 * Everything here reads the command chain. Nothing here reads or writes access
 * grants: a query's audience is decided by the chain, not by visibility, and
 * the two must not be quietly merged.
 *
 * Openness is derived from two facts, never cached: the deadline, and whether
 * the sender ended it early. See `isOpen`.
 */

/** A commander of a TEAM has nobody below, so the lowest level only answers. */
export function canSendFrom(kind: OrgKind): boolean {
  return kind !== "TEAM";
}

/**
 * Any commander can RECEIVE. This used to exclude the center — reasoned from
 * "nobody is above them" — but recipients are chosen now and may come from any
 * direction, so being addressable follows from being commanded, not from rank.
 * Sending and receiving are different questions: `canSendFrom` still refuses
 * teams.
 */
export function canReceiveAt(_kind: OrgKind): boolean {
  return true;
}

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

/**
 * May this user read this query?
 *
 * The whole rule, with no exceptions — not for the level above, and not for the
 * Admin, on the same footing as the private rules page. Written as one function
 * because it will come under pressure: somebody will eventually want a report
 * that crosses it, and that should be a decision, not a leak.
 */
export function mayRead(
  user: { commandsNodeId: string | null },
  query: { senderNodeId: string; targets: { nodeId: string }[] },
): boolean {
  const mine = user.commandsNodeId;
  if (!mine) return false;
  return query.senderNodeId === mine || query.targets.some((t) => t.nodeId === mine);
}

/** May this user ANSWER this target row — i.e. do they command that framework, and is it open? */
export function mayAnswer(
  user: { commandsNodeId: string | null },
  query: { dueDate: Date; closedAt?: Date | null },
  target: { nodeId: string },
  now: Date = new Date(),
): boolean {
  return !!user.commandsNodeId && user.commandsNodeId === target.nodeId && isOpen(query, now);
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

export async function queryBadge(commandsNodeId: string | null, now: Date = new Date()): Promise<QueryBadge> {
  if (!commandsNodeId) return { awaitingMyAnswer: 0, newAnswers: 0, total: 0 };
  const [awaitingMyAnswer, newAnswers] = await Promise.all([
    prisma.queryTarget.count({
      where: { nodeId: commandsNodeId, answer: null, query: { closedAt: null, dueDate: { gte: todayMarker(now) } } },
    }),
    prisma.queryTarget.count({
      where: { query: { senderNodeId: commandsNodeId }, answer: { not: null }, seenBySender: false },
    }),
  ]);
  return { awaitingMyAnswer, newAnswers, total: awaitingMyAnswer + newAnswers };
}

/** How many queries await an answer from this user right now. */
export async function outstandingCount(commandsNodeId: string | null, now: Date = new Date()): Promise<number> {
  return (await queryBadge(commandsNodeId, now)).awaitingMyAnswer;
}
