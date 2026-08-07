"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { parseIsraeliDate, formatIsraeliDate, todayMarker } from "@/lib/dates";
import { commandedPath } from "@/lib/commander";
import {
  canSendFrom,
  isOpen,
  isSenderOf,
  lateralRecipients,
  mayRead,
  recipientsOf,
  lateralScope,
  validLateralRecipient,
  validRecipient,
} from "@/lib/queries";
import { sendReport } from "@/lib/emailer";
import { stripMentions } from "@/lib/mentions";
import { staffSenderLabel } from "@/lib/query-sender";
import type { AccessLevel, Role } from "@/generated/prisma/client";

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

/** The signed-in user together with the framework they command. Refused outright when they command nothing. */
async function requireCommander() {
  const session = await getSessionUser();
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, name: true, commandsNodeId: true, commandsNode: { select: { id: true, name: true, kind: true } } },
  });
  if (!user?.commandsNode) throw new Error("עמוד השאילתות פתוח למפקדי מסגרות בלבד.");
  return { ...user, commandsNode: user.commandsNode, commandsNodeId: user.commandsNodeId! };
}

/**
 * The signed-in user as a CORRESPONDENT — someone who may hold a conversation
 * on this page at all. Two ways in, and they are not the same identity:
 *
 *   a commander  → the correspondent is their framework
 *   an HR user   → the correspondent is the person, bounded by their grants
 *
 * An HR user with no grant is refused for the same reason a Manager who
 * commands nothing is: there is nobody for them to be.
 */
async function requireCorrespondent() {
  const session = await getSessionUser();
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      name: true,
      role: true,
      commandsNodeId: true,
      commandsNode: { select: { id: true, name: true, kind: true } },
      grants: { select: { nodeId: true, level: true } },
    },
  });
  if (!user) throw new Error("משתמש לא נמצא.");
  if (user.role === "HR") {
    if (user.grants.length === 0) {
      throw new Error("עמוד השאילתות נפתח למשא״ן רק לאחר שהוקצתה לו מסגרת.");
    }
    return user;
  }
  if (!user.commandsNode) throw new Error("עמוד השאילתות פתוח למפקדי מסגרות בלבד.");
  return user;
}

/** The SessionUser shape `computeVisibility` wants, from a correspondent row. */
function asSessionUser(u: { id: string; name: string; role: Role; grants: { nodeId: string; level: AccessLevel }[] }) {
  return { id: u.id, name: u.name, role: u.role, grants: u.grants };
}

/**
 * Mail a commander about a query, after the response has gone out.
 *
 * `after()` because a center with eight domains means eight python subprocesses,
 * and the sender should not sit through them. The cost of not waiting is that
 * the sender is no longer there to see a failure — so the outcome is written to
 * the target row, which is where the list reads it from.
 */
function mailTarget(targetId: string, to: string, title: string, body: string) {
  after(async () => {
    const result = await sendReport({ title, body, to });
    await prisma.queryTarget
      .update({
        where: { id: targetId },
        data: { mailOk: result.ok, mailError: result.ok ? null : (result as { reason: string }).reason.slice(0, 300) },
      })
      .catch(() => {}); // the row may be gone by now; the mail outcome is not worth a crash
  });
}

function notificationBody(kind: "new" | "reminder", q: { title: string; body: string; dueDate: Date }, senderPath: string) {
  return [
    kind === "new" ? `# שאילתא חדשה: ${q.title}` : `# תזכורת: ${q.title}`,
    "",
    `**מאת:** ${senderPath}`,
    `**להשלמה עד:** ${formatIsraeliDate(q.dueDate)}`,
    "",
    // flattened to plain `@name`: the raw tag would arrive in the inbox as
    // literal `@[דנה כהן](cmsf…)`
    stripMentions(q.body),
    "",
    kind === "reminder" ? "_טרם התקבלה תשובתך._" : "",
  ]
    .filter((l) => l !== null)
    .join("\n");
}

/** What the ASKER is told when an answer lands. */
function answerNotification(title: string, fromPath: string, answer: string, revised: boolean) {
  return [
    `# ${revised ? "תשובה מעודכנת" : "התקבלה תשובה"}: ${title}`,
    "",
    `**מאת:** ${fromPath}`,
    "",
    stripMentions(answer),
  ].join("\n");
}

export async function createQuery(formData: FormData) {
  const me = await requireCorrespondent();
  const lateral = me.role === "HR";
  if (!lateral && !canSendFrom(me.commandsNode!.kind)) {
    throw new Error("מפקד צוות אינו יכול לשלוח שאילתא — אין מסגרות תחתיו.");
  }

  const title = str(formData.get("title"));
  const body = str(formData.get("body"));
  const dueDate = parseIsraeliDate(str(formData.get("dueDate")));
  if (!title) throw new Error("חובה להזין כותרת.");
  if (!body) throw new Error("חובה להזין תוכן.");
  if (!dueDate) throw new Error("חובה להזין תאריך אחרון למילוי בפורמט dd/mm/yyyy.");
  if (dueDate.getTime() < todayMarker().getTime()) throw new Error("התאריך האחרון למילוי כבר עבר.");

  // Recipients are CHOSEN now; the level below is only the form's default.
  // The absence of the field entirely (an old form, a hand-built POST) falls
  // back to that same default, so untouched behaviour is untouched.
  const chosen = formData.getAll("recipients").map((v) => String(v).trim()).filter(Boolean);
  // A lateral sender has NO default audience: "the level below" is a chain
  // notion and there is no chain here. They choose, or nothing goes.
  const defaults = lateral ? [] : await recipientsOf(me.commandsNodeId!);
  const recipientIds = chosen.length > 0 || formData.has("recipientsExplicit") || lateral
    ? [...new Set(chosen)]
    : defaults.map((r) => r.nodeId);

  if (recipientIds.length === 0) {
    throw new Error(
      lateral
        ? "שאילתא צריכה נמען אחד לפחות — סמן מסגרת מהרשימה."
        : "שאילתא צריכה נמען אחד לפחות — סמן מסגרת מהרשימה או הוסף מפקד עם @.",
    );
  }
  // The form offers only legal recipients, but the form is a convenience and
  // this is the rule. Two rules, one per kind of sender.
  for (const id of recipientIds) {
    const ok = lateral
      ? await validLateralRecipient(asSessionUser(me), id)
      : await validRecipient(me.commandsNodeId!, id);
    if (!ok) {
      throw new Error(
        lateral
          ? "אחד הנמענים אינו חוקי — משא״ן פונה למסגרות מפוקדות בתוך המסגרת שהוקצתה לו בלבד."
          : "אחד הנמענים אינו חוקי — נמען הוא מסגרת בת ישירה, או מסגרת מפוקדת בכל מקום בעץ.",
      );
    }
  }

  // For a lateral query senderNodeId is the SCOPE the request was made under,
  // never the sender: the highest granted node that contains every recipient.
  const senderNodeId = lateral ? await lateralScope(asSessionUser(me), recipientIds) : me.commandsNodeId!;

  const query = await prisma.query.create({
    data: {
      senderKind: lateral ? "STAFF" : "FRAMEWORK",
      senderNodeId,
      authorId: me.id,
      title,
      body,
      dueDate,
      // a row per chosen framework — a child with no commander stays choosable,
      // which is exactly how the sender sees that nobody can answer for it
      targets: { create: recipientIds.map((nodeId) => ({ nodeId })) },
    },
    include: { targets: { include: { node: { select: { commander: { select: { email: true } } } } } } },
  });

  const senderPath = lateral ? staffSenderLabel(me.name) : await commandedPath(me.commandsNodeId!);
  for (const t of query.targets) {
    const email = t.node.commander?.email;
    if (email) mailTarget(t.id, email, title, notificationBody("new", query, senderPath));
  }

  revalidatePath("/queries");
  revalidatePath("/", "layout"); // the outstanding counter in the header
}

/** Load a query the signed-in user is a party to, or refuse. */
async function readableQuery(queryId: string, me: { id: string; commandsNodeId: string | null }) {
  const query = await prisma.query.findUnique({
    where: { id: queryId },
    include: { targets: true },
  });
  if (!query || !mayRead(me, query)) {
    // same message either way: whether it exists is itself none of their business
    throw new Error("שאילתא לא נמצאה.");
  }
  return query;
}

export async function answerQuery(formData: FormData) {
  const me = await requireCommander();
  const queryId = str(formData.get("queryId"));
  const answer = str(formData.get("answer"));
  if (!answer) throw new Error("חובה להזין תשובה.");

  const query = await readableQuery(queryId, me);
  const target = query.targets.find((t) => t.nodeId === me.commandsNodeId);
  if (!target) throw new Error("השאילתא אינה מופנית למסגרת שבפיקודך.");
  if (!isOpen(query)) {
    throw new Error(
      query.closedAt
        ? "השאילתא נסגרה על ידי השולח, ולא ניתן עוד לענות או לתקן."
        : `התאריך האחרון למילוי (${formatIsraeliDate(query.dueDate)}) עבר, ולא ניתן עוד לענות או לתקן.`,
    );
  }

  // answeredAt marks the FIRST answer and never moves; updatedAt appears only
  // on a revision, so a first answer carries no "changed on" date to explain.
  const revised = !!target.answeredAt;
  await prisma.queryTarget.update({
    where: { id: target.id },
    data: {
      answer,
      answeredById: me.id,
      answeredAt: target.answeredAt ?? new Date(),
      updatedAt: revised ? new Date() : null,
      seenBySender: false, // a revision is news too, so this resets every time
    },
  });

  // Tell the asker. For a framework query that is whoever commands the SENDING
  // framework now — the same anchoring as everything else here, so a query that
  // outlived its author still reaches the person now responsible for it. For a
  // lateral query there is no framework to anchor to: the author IS the asker.
  const to =
    query.senderKind === "STAFF"
      ? (await prisma.user.findUnique({ where: { id: query.authorId ?? "" }, select: { email: true } }))?.email
      : (
          await prisma.orgNode.findUnique({
            where: { id: query.senderNodeId },
            select: { commander: { select: { email: true } } },
          })
        )?.commander?.email;
  if (to) {
    mailTarget(target.id, to, query.title, answerNotification(query.title, await commandedPath(me.commandsNodeId), answer, revised));
  }

  revalidatePath("/queries");
  revalidatePath("/", "layout");
}

/**
 * Delete a query outright.
 *
 * The recipients' copies go with it: `QueryTarget` cascades on the query, so
 * there is no second deletion to remember and no window in which a target row
 * survives the question it answered. Answers are destroyed with it, which is
 * why the button confirms and names how many are about to be lost.
 */
export async function deleteQuery(formData: FormData) {
  const me = await requireCorrespondent();
  const queryId = str(formData.get("queryId"));
  const query = await readableQuery(queryId, me);
  if (!isSenderOf(me, query)) throw new Error("רק מי ששלח את השאילתא יכול למחוק אותה.");

  await prisma.query.delete({ where: { id: queryId } }); // targets cascade
  revalidatePath("/queries");
  revalidatePath("/", "layout");
}

export async function updateQueryDue(formData: FormData) {
  const me = await requireCorrespondent();
  const queryId = str(formData.get("queryId"));
  const dueDate = parseIsraeliDate(str(formData.get("dueDate")));
  if (!dueDate) throw new Error("תאריך לא תקין — נדרש dd/mm/yyyy.");

  const query = await readableQuery(queryId, me);
  if (!isSenderOf(me, query)) throw new Error("רק מי ששלח את השאילתא יכול לשנות את התאריך.");

  // A past date is simply not a deadline. Closing early is a separate, explicit
  // act with its own button — asking for confirmation here instead turned an
  // ordinary typo into what looked like a crash.
  if (dueDate.getTime() < todayMarker().getTime()) {
    throw new Error(`${formatIsraeliDate(dueDate)} כבר עבר. לתאריך יעד בחר יום מהיום והלאה, ולסגירה מיידית השתמש בכפתור ״סגור שאילתא״.`);
  }

  await prisma.query.update({ where: { id: queryId }, data: { dueDate, dueChangedAt: new Date() } });
  revalidatePath("/queries");
  revalidatePath("/", "layout");
}

/**
 * End a query early — the answers that came in are enough.
 *
 * Deliberately NOT done by pushing `dueDate` into the past. That would need no
 * column and would rewrite the deadline everyone was given into yesterday's
 * date; `closedAt` records what actually happened and leaves the stated
 * deadline true.
 */
export async function closeQuery(formData: FormData) {
  const me = await requireCorrespondent();
  const queryId = str(formData.get("queryId"));
  const query = await readableQuery(queryId, me);
  if (!isSenderOf(me, query)) throw new Error("רק מי ששלח את השאילתא יכול לסגור אותה.");
  if (query.closedAt) throw new Error("השאילתא כבר סגורה.");

  await prisma.query.update({ where: { id: queryId }, data: { closedAt: new Date() } });
  revalidatePath("/queries");
  revalidatePath("/", "layout");
}

/**
 * Undo an early close.
 *
 * A close with no undo is a trap: the sender is deciding on partial answers,
 * and deciding wrongly must not be permanent. Reopening restores whatever the
 * deadline says — if that date has itself passed by now, the query stays shut,
 * which is the deadline doing its job rather than the close.
 */
export async function reopenQuery(formData: FormData) {
  const me = await requireCorrespondent();
  const queryId = str(formData.get("queryId"));
  const query = await readableQuery(queryId, me);
  if (!isSenderOf(me, query)) throw new Error("רק מי ששלח את השאילתא יכול לפתוח אותה מחדש.");

  await prisma.query.update({ where: { id: queryId }, data: { closedAt: null } });
  revalidatePath("/queries");
  revalidatePath("/", "layout");
}

export async function updateQueryContent(formData: FormData) {
  const me = await requireCorrespondent();
  const queryId = str(formData.get("queryId"));
  const title = str(formData.get("title"));
  const body = str(formData.get("body"));
  if (!title || !body) throw new Error("חובה להזין כותרת ותוכן.");

  const query = await readableQuery(queryId, me);
  if (!isSenderOf(me, query)) throw new Error("רק מי ששלח את השאילתא יכול לערוך אותה.");

  // Editing the question after answers exist produces the most confusing state
  // there is: answers to a question that no longer appears on screen.
  const answered = query.targets.filter((t) => t.answer).length;
  if (answered > 0) {
    throw new Error(`לא ניתן לערוך את תוכן השאילתא — ${answered} מסגרות כבר השיבו. את התאריך עדיין אפשר לשנות.`);
  }

  await prisma.query.update({ where: { id: queryId }, data: { title, body } });
  revalidatePath("/queries");
}

export async function remindTarget(formData: FormData) {
  const me = await requireCorrespondent();
  const targetId = str(formData.get("targetId"));

  const target = await prisma.queryTarget.findUnique({
    where: { id: targetId },
    include: { query: { include: { targets: true } }, node: { select: { commander: { select: { email: true } } } } },
  });
  if (!target) throw new Error("שורה לא נמצאה.");
  if (!isSenderOf(me, target.query)) throw new Error("רק השולח יכול לשלוח תזכורת.");
  if (target.answer) throw new Error("המסגרת כבר השיבה — אין למה להזכיר.");

  const to = target.node.commander?.email;
  if (!to) throw new Error("אין מפקד למסגרת זו, ולכן אין למי לשלוח תזכורת.");

  await prisma.queryTarget.update({ where: { id: targetId }, data: { remindedAt: new Date() } });
  // the reminder must name the sender the same way the original mail did
  const fromLine =
    target.query.senderKind === "STAFF" ? staffSenderLabel(me.name) : await commandedPath(me.commandsNodeId!);
  mailTarget(targetId, to, target.query.title, notificationBody("reminder", target.query, fromLine));

  revalidatePath("/queries");
}
