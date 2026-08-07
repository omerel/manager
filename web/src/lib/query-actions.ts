"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { parseIsraeliDate, formatIsraeliDate, todayMarker } from "@/lib/dates";
import { commandedPath } from "@/lib/commander";
import { canSendFrom, isOpen, mayRead, recipientsOf, validRecipient } from "@/lib/queries";
import { sendReport } from "@/lib/emailer";
import { stripMentions } from "@/lib/mentions";

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
  const me = await requireCommander();
  if (!canSendFrom(me.commandsNode.kind)) {
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
  const defaults = await recipientsOf(me.commandsNodeId);
  const recipientIds = chosen.length > 0 || formData.has("recipientsExplicit")
    ? [...new Set(chosen)]
    : defaults.map((r) => r.nodeId);

  if (recipientIds.length === 0) {
    throw new Error("שאילתא צריכה נמען אחד לפחות — סמן מסגרת מהרשימה או הוסף מפקד עם @.");
  }
  // The form offers only legal recipients, but the form is a convenience and
  // this is the rule: a direct child, or a commanded framework anywhere.
  for (const id of recipientIds) {
    if (!(await validRecipient(me.commandsNodeId, id))) {
      throw new Error("אחד הנמענים אינו חוקי — נמען הוא מסגרת בת ישירה, או מסגרת מפוקדת בכל מקום בעץ.");
    }
  }

  const query = await prisma.query.create({
    data: {
      senderNodeId: me.commandsNodeId,
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

  const senderPath = await commandedPath(me.commandsNodeId);
  for (const t of query.targets) {
    const email = t.node.commander?.email;
    if (email) mailTarget(t.id, email, title, notificationBody("new", query, senderPath));
  }

  revalidatePath("/queries");
  revalidatePath("/", "layout"); // the outstanding counter in the header
}

/** Load a query the signed-in user is a party to, or refuse. */
async function readableQuery(queryId: string, me: { commandsNodeId: string }) {
  const query = await prisma.query.findUnique({
    where: { id: queryId },
    include: { targets: true },
  });
  if (!query || !mayRead({ commandsNodeId: me.commandsNodeId }, query)) {
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

  // Tell the asker. Addressed to whoever commands the SENDING framework now —
  // the same anchoring as everything else here, so a query that outlived its
  // author still reaches the person now responsible for it.
  const senderCommander = await prisma.orgNode.findUnique({
    where: { id: query.senderNodeId },
    select: { commander: { select: { email: true } } },
  });
  const to = senderCommander?.commander?.email;
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
  const me = await requireCommander();
  const queryId = str(formData.get("queryId"));
  const query = await readableQuery(queryId, me);
  if (query.senderNodeId !== me.commandsNodeId) throw new Error("רק המסגרת ששלחה את השאילתא יכולה למחוק אותה.");

  await prisma.query.delete({ where: { id: queryId } }); // targets cascade
  revalidatePath("/queries");
  revalidatePath("/", "layout");
}

export async function updateQueryDue(formData: FormData) {
  const me = await requireCommander();
  const queryId = str(formData.get("queryId"));
  const dueDate = parseIsraeliDate(str(formData.get("dueDate")));
  if (!dueDate) throw new Error("תאריך לא תקין — נדרש dd/mm/yyyy.");

  const query = await readableQuery(queryId, me);
  if (query.senderNodeId !== me.commandsNodeId) throw new Error("רק המסגרת ששלחה את השאילתא יכולה לשנות את התאריך.");

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
  const me = await requireCommander();
  const queryId = str(formData.get("queryId"));
  const query = await readableQuery(queryId, me);
  if (query.senderNodeId !== me.commandsNodeId) throw new Error("רק המסגרת ששלחה את השאילתא יכולה לסגור אותה.");
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
  const me = await requireCommander();
  const queryId = str(formData.get("queryId"));
  const query = await readableQuery(queryId, me);
  if (query.senderNodeId !== me.commandsNodeId) throw new Error("רק המסגרת ששלחה את השאילתא יכולה לפתוח אותה מחדש.");

  await prisma.query.update({ where: { id: queryId }, data: { closedAt: null } });
  revalidatePath("/queries");
  revalidatePath("/", "layout");
}

export async function updateQueryContent(formData: FormData) {
  const me = await requireCommander();
  const queryId = str(formData.get("queryId"));
  const title = str(formData.get("title"));
  const body = str(formData.get("body"));
  if (!title || !body) throw new Error("חובה להזין כותרת ותוכן.");

  const query = await readableQuery(queryId, me);
  if (query.senderNodeId !== me.commandsNodeId) throw new Error("רק המסגרת ששלחה את השאילתא יכולה לערוך אותה.");

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
  const me = await requireCommander();
  const targetId = str(formData.get("targetId"));

  const target = await prisma.queryTarget.findUnique({
    where: { id: targetId },
    include: { query: { include: { targets: true } }, node: { select: { commander: { select: { email: true } } } } },
  });
  if (!target) throw new Error("שורה לא נמצאה.");
  if (target.query.senderNodeId !== me.commandsNodeId) throw new Error("רק השולח יכול לשלוח תזכורת.");
  if (target.answer) throw new Error("המסגרת כבר השיבה — אין למה להזכיר.");

  const to = target.node.commander?.email;
  if (!to) throw new Error("אין מפקד למסגרת זו, ולכן אין למי לשלוח תזכורת.");

  await prisma.queryTarget.update({ where: { id: targetId }, data: { remindedAt: new Date() } });
  mailTarget(targetId, to, target.query.title, notificationBody("reminder", target.query, await commandedPath(me.commandsNodeId)));

  revalidatePath("/queries");
}
