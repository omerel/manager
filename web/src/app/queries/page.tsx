import Link from "next/link";
import { after } from "next/server";
import { AlertTriangle, CheckCircle2, MailWarning, UserX, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { KIND_LABEL } from "@/lib/org-kinds";
import { pathResolver } from "@/lib/commander";
import { canSendFrom, isOpen, recipientsOf, commandedFrameworks, lateralRecipients } from "@/lib/queries";
import { senderLabel, STAFF_SENDER_TITLE } from "@/lib/query-sender";
import { fmtDate, formatIsraeliDate, todayMarker } from "@/lib/dates";
import { DateField } from "@/components/DateField";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { MentionTextarea, type MentionablePerson } from "@/components/MentionTextarea";
import { RecipientPicker, type AddableFramework, type DefaultRecipient } from "@/components/RecipientPicker";
import { MentionText, type MentionDirectory } from "@/components/MentionText";
import { mentionedIds } from "@/lib/mentions";
import { computeVisibility } from "@/lib/access";
import { createQuery, answerQuery, updateQueryDue, updateQueryContent, remindTarget, closeQuery, reopenQuery, deleteQuery } from "@/lib/query-actions";

const inputCls = "rounded-md border border-border px-3 py-1.5 text-sm";

export default async function QueriesPage({ searchParams }: { searchParams: Promise<{ q?: string; side?: string }> }) {
  const { q: rawQuery, side: rawSide } = await searchParams;
  const side = rawSide === "mine" || rawSide === "forme" ? rawSide : "all";
  const query = (rawQuery ?? "").trim();
  const session = await getSessionUser();
  const me = await prisma.user.findUnique({
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

  // The page belongs to correspondents. A commander corresponds as their
  // framework; an HR user corresponds as themselves, bounded by their grants.
  // Anyone who is neither has no place here — including the Admin.
  const lateral = me?.role === "HR";
  const hasIdentity = lateral ? (me?.grants.length ?? 0) > 0 : !!me?.commandsNode && !!me.commandsNodeId;
  if (!me || !hasIdentity) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">שאילתות</h1>
        <div className="rounded-xl border border-border/70 bg-card p-6 text-muted shadow-sm">
          {lateral
            ? "עמוד השאילתות ייפתח לאחר שתוקצה לך מסגרת."
            : "עמוד זה מיועד למפקדי מסגרות. לא משויכת אליך מסגרת בפיקוד."}
        </div>
      </div>
    );
  }

  // A lateral sender has no framework identity; `mine` is the commander's, and
  // is only ever consulted on the paths that belong to a commander.
  const mine = me.commandsNodeId ?? "";
  const nodes = await prisma.orgNode.findMany();
  const resolve = pathResolver(nodes);

  // Search covers what a person would actually remember about a query: its
  // title, its text, the answers it drew, and the framework at the other end.
  const like = { contains: query, mode: "insensitive" as const };
  const sentFilter = query
    ? {
        OR: [
          { title: like },
          { body: like },
          { targets: { some: { answer: like } } },
          { targets: { some: { node: { name: like } } } },
        ],
      }
    : {};
  const receivedFilter = query
    ? {
        OR: [
          { answer: like },
          { query: { is: { OR: [{ title: like }, { body: like }, { sender: { is: { name: like } } }] } } },
        ],
      }
    : {};

  const [sent, received] = await Promise.all([
    prisma.query.findMany({
      // the same rule as isSenderOf, expressed as a filter: a commander's
      // framework sent it, or this person did
      where: lateral
        ? { senderKind: "STAFF" as const, authorId: me.id, ...sentFilter }
        : { senderKind: "FRAMEWORK" as const, senderNodeId: mine, ...sentFilter },
      orderBy: { createdAt: "desc" },
      include: {
        targets: {
          include: { node: { select: { name: true, kind: true, commander: { select: { name: true } } } }, answeredBy: { select: { name: true } } },
        },
      },
    }),
    // An HR user is addressed by nobody: queries go to frameworks, and they are
    // a person. Not an empty panel — no panel.
    lateral ? [] : prisma.queryTarget.findMany({
      where: { nodeId: mine, ...receivedFilter },
      orderBy: { query: { createdAt: "desc" } },
      include: { query: { include: { sender: { select: { name: true } }, author: { select: { name: true } } } } },
    }),
  ]);

  // Who this user may TAG: people they can see. The picker is clipped to the
  // writer's visibility, exactly as every other person list in the app is.
  const visibility = await computeVisibility(session);
  const resolvePath = pathResolver(nodes);
  const mentionable: MentionablePerson[] = (
    await prisma.person.findMany({
      where: visibility.isAdmin ? {} : { teamId: { in: [...visibility.nodeIds] } },
      select: { id: true, fullName: true, teamId: true },
      orderBy: { fullName: "asc" },
    })
  ).map((p) => ({ id: p.id, name: p.fullName, team: resolvePath(p.teamId) || "ללא שיוך" }));

  // Who this user may FOLLOW a tag to. Resolved from the id rather than the
  // stored label, so a person renamed since being tagged reads correctly.
  const referenced = mentionedIds(
    ...sent.flatMap((q) => [q.body, ...q.targets.map((t) => t.answer)]),
    ...received.flatMap((t) => [t.query.body, t.answer]),
  );
  const directory: MentionDirectory = new Map(
    (
      await prisma.person.findMany({
        where: { id: { in: referenced } },
        select: { id: true, fullName: true, teamId: true },
      })
    ).map((p) => [
      p.id,
      { name: p.fullName, visible: p.teamId ? visibility.nodeIds.has(p.teamId) : visibility.isAdmin },
    ]),
  );

  // Everything new the sender is looking at right now stops being new — but
  // only AFTER this response has gone out. Mutating during render would clear
  // the badge on a prefetch, before anyone had actually looked at anything.
  const unseen = sent.flatMap((qq) => qq.targets.filter((t) => t.answer && !t.seenBySender).map((t) => t.id));
  if (unseen.length > 0) {
    after(async () => {
      await prisma.queryTarget.updateMany({ where: { id: { in: unseen } }, data: { seenBySender: true } });
    });
  }

  const today = todayMarker();
  // a lateral sender always may; the team-level refusal is about having nothing
  // beneath you in a chain this sender is not part of
  const canSend = lateral || canSendFrom(me.commandsNode!.kind);

  // Open queries first — they are what needs acting on; closed ones collapse
  // below them. The sort is stable, so inside each group the newest-first
  // ordering from the database survives.
  const openFirst = <T,>(arr: T[], opened: (x: T) => boolean) =>
    [...arr].sort((a, b) => Number(opened(b)) - Number(opened(a)));
  const sentSorted = openFirst(sent, (q) => isOpen(q));
  const receivedSorted = openFirst(received, (t) => isOpen(t.query));

  const showMine = canSend && (lateral || side !== "forme");
  const showForMe = !lateral && side !== "mine"; // every commander may be addressed; a person is not

  // A commander's chooser: the level below pre-checked, plus ‎@‎ over every
  // commanded framework anywhere. A lateral sender's chooser: the commanded
  // frameworks inside their granted subtrees, none pre-checked, no ‎@‎ — the
  // reach IS the subtree, and ‎@‎ would erase exactly that.
  const [defaults, commanded] = !canSend
    ? [[], []]
    : lateral
      ? [await lateralRecipients({ id: me.id, name: me.name, role: me.role, grants: me.grants }), []]
      : await Promise.all([recipientsOf(mine), commandedFrameworks()]);
  const defaultRecipients: DefaultRecipient[] = defaults.map((r) => ({
    nodeId: r.nodeId, name: r.name, kind: r.kind, commanderName: r.commander?.name ?? null,
  }));
  const addableFrameworks: AddableFramework[] = commanded
    .filter((c) => c.nodeId !== mine)
    .map((c) => ({ nodeId: c.nodeId, path: c.path, kind: c.kind, commanderName: c.commander!.name }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{lateral ? "שאילתות משא״ן" : "שאילתות מפקד"}</h1>
        <p className="mt-1 text-muted">
          {lateral
            ? `${me.name} · ${STAFF_SENDER_TITLE} · פנייה רוחבית למפקדים בתוך המסגרת שהוקצתה לך. שאילתא נראית לך ולנשאל בלבד.`
            : `${KIND_LABEL[me.commandsNode!.kind]} ${me.commandsNode!.name} · שאילתא נראית לשולח ולנשאל בלבד — לא לרמה שמעליהם ולא למסגרות אחיות.`}
        </p>
      </div>

      <form method="get" action="/queries" className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="חיפוש לפי כותרת, תוכן, תשובה או מסגרת…"
          className={`w-80 bg-card ${inputCls}`}
        />
        {!lateral && (
          <select name="side" defaultValue={side} className={`bg-card ${inputCls}`}>
            <option value="all">שני הצדדים</option>
            <option value="mine">רק השאילתות שלי</option>
            <option value="forme">רק שאילתות עבורי</option>
          </select>
        )}
        <button className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-slate-50">חפש</button>
        {(query || side !== "all") && (
          <Link href="/queries" className="rounded-md px-3 py-1.5 text-sm text-muted hover:underline">
            נקה
          </Link>
        )}
        {query && (
          <span className="text-xs text-muted">
            {sent.length + received.length} תוצאות עבור ״{query}״
          </span>
        )}
      </form>

      {canSend && (
        <section className="space-y-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
          <h2 className="font-semibold">שאילתא חדשה</h2>
          <form action={createQuery} className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col">
                <label htmlFor="title" className="mb-1 text-sm text-muted">כותרת</label>
                <input id="title" name="title" required placeholder="למשל: מצב הסמכות ברבעון" className={`w-72 ${inputCls}`} />
              </div>
              <DateField name="dueDate" label="תאריך אחרון למילוי" required minDate={today} className={`${inputCls} w-44`} />
            </div>
            <div className="flex flex-col">
              <label htmlFor="body" className="mb-1 text-sm text-muted">תוכן קצר</label>
              <MentionTextarea name="body" people={mentionable} required rows={3} className={`${inputCls} w-full`} />
            </div>
            <RecipientPicker defaults={defaultRecipients} addable={addableFrameworks} preselect={!lateral} />
            <button className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
              שלח שאילתא
            </button>
            <p className="text-xs text-muted">
              ברירת המחדל: כל הדרגה שמתחתיך. אפשר להסיר, ואפשר לצרף ב-‎@‎ מפקד של כל מסגרת בעץ. למפקדי הנמענים נשלח מייל.
              בגוף הטקסט, ‎@‎ מתייג אדם — לחיצה על התיוג תפתח את כרטיסו בלשונית חדשה.
            </p>
          </form>
        </section>
      )}

      <div className={`grid grid-cols-1 gap-6 ${showMine && showForMe ? "xl:grid-cols-2" : ""}`}>
      {showMine && (
        <section className="space-y-3">
          <h2 className="font-semibold">השאילתות שלי</h2>
          {sent.length === 0 ? (
            <p className="text-muted">{query ? `אין שאילתות ששלחת התואמות ל״${query}״.` : "טרם שלחת שאילתות."}</p>
          ) : (
            sentSorted.map((q) => {
              const open = isOpen(q);
              const pending = q.targets.filter((t) => !t.answer).length;
              const answered = q.targets.length - pending;
              const frozen = q.targets.some((t) => t.answer);
              const inner = (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span className="font-semibold">{q.title}</span>
                      <StatusPill open={open} closedEarly={!!q.closedAt} />
                      <span className="text-xs text-muted">
                        עד {formatIsraeliDate(q.dueDate)}
                        {q.dueChangedAt && ` · התאריך עודכן ${fmtDate(q.dueChangedAt)}`}
                        {q.closedAt && ` · נסגרה ${fmtDate(q.closedAt)}`}
                      </span>
                    </span>
                    <span className="text-xs text-muted">
                      {q.targets.length - pending}/{q.targets.length} הגיבו
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-muted">
                    <MentionText text={q.body} directory={directory} />
                  </div>

                  <ul className="mt-3 space-y-2">
                    {q.targets.map((t) => (
                      <li key={t.id} className="rounded-md border border-border px-3 py-2 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="flex items-center gap-2">
                            <span className="text-xs text-muted">{KIND_LABEL[t.node.kind]}</span>
                            <span className="font-medium">{t.node.name}</span>
                            {!t.node.commander && (
                              <Link
                                href="/access"
                                className="flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900 hover:underline"
                              >
                                <UserX className="h-3 w-3" aria-hidden />
                                אין מפקד למסגרת — למינוי
                              </Link>
                            )}
                            {t.mailOk === false && (
                              <span className="flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-xs text-red-800" title={t.mailError ?? ""}>
                                <MailWarning className="h-3 w-3" aria-hidden />
                                המייל נכשל
                              </span>
                            )}
                          </span>
                          <span className="flex items-center gap-3">
                            {t.remindedAt && <span className="text-xs text-muted">הוזכר {fmtDate(t.remindedAt)}</span>}
                            {!t.answer && t.node.commander && (
                              <form action={remindTarget} className="inline">
                                <input type="hidden" name="targetId" value={t.id} />
                                <button className="text-xs text-brand-700 hover:underline">שלח תזכורת</button>
                              </form>
                            )}
                          </span>
                        </div>
                        {t.answer ? (
                          <div className={`mt-2 rounded p-2 ${t.seenBySender ? "bg-brand-50/60" : "bg-amber-50 ring-1 ring-amber-300"}`}>
                            {!t.seenBySender && (
                              <span className="mb-1 flex items-center gap-1 text-xs font-medium text-amber-900">
                                <Sparkles className="h-3 w-3" aria-hidden />
                                תשובה חדשה
                              </span>
                            )}
                            <MentionText text={t.answer} directory={directory} />
                            <p className="mt-1 text-xs text-muted">
                              {t.answeredBy?.name} · הגיב {fmtDate(t.answeredAt)}
                              {t.updatedAt && ` · עודכן לאחרונה ${fmtDate(t.updatedAt)}`}
                            </p>
                          </div>
                        ) : (
                          <p className="mt-1 text-xs text-muted">טרם הגיב.</p>
                        )}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-3 flex flex-wrap items-end gap-4 border-t border-border/60 pt-3">
                    <form action={updateQueryDue} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="queryId" value={q.id} />
                      <DateField name="dueDate" label="שינוי תאריך" defaultDate={q.dueDate} minDate={today} className={`${inputCls} w-40`} />
                      <button className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-slate-50">עדכן</button>
                    </form>
                    <ConfirmSubmit
                      action={deleteQuery}
                      queryId={q.id}
                      label="מחק שאילתא"
                      className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                      confirm={
                        answered > 0
                          ? `למחוק את השאילתא ״${q.title}״? ${answered} תשובות שהתקבלו יימחקו יחד איתה, וגם העותקים אצל הנשאלים. אי אפשר לבטל.`
                          : `למחוק את השאילתא ״${q.title}״? היא תיעלם גם אצל ${q.targets.length} המסגרות שקיבלו אותה. אי אפשר לבטל.`
                      }
                    />
                    {q.closedAt ? (
                      <form action={reopenQuery} className="pb-0.5">
                        <input type="hidden" name="queryId" value={q.id} />
                        <button className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-slate-50">
                          פתח מחדש
                        </button>
                      </form>
                    ) : (
                      <ConfirmSubmit
                        action={closeQuery}
                        queryId={q.id}
                        label="סגור שאילתא"
                        confirm={
                          pending > 0
                            ? `לסגור את השאילתא עכשיו? ${answered} מתוך ${q.targets.length} הגיבו, ו-${pending} לא יוכלו עוד להשיב.`
                            : `לסגור את השאילתא עכשיו? כל ${q.targets.length} המסגרות הגיבו.`
                        }
                      />
                    )}
                    {!frozen && (
                      <details className="text-sm">
                        <summary className="cursor-pointer text-brand-700">ערוך תוכן</summary>
                        <form action={updateQueryContent} className="mt-2 space-y-2">
                          <input type="hidden" name="queryId" value={q.id} />
                          <input name="title" defaultValue={q.title} required className={`w-72 ${inputCls}`} />
                          <MentionTextarea name="body" people={mentionable} defaultValue={q.body} required rows={3} className={`${inputCls} w-full`} />
                          <button className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-slate-50">שמור</button>
                        </form>
                      </details>
                    )}
                    {frozen && (
                      <p className="flex items-center gap-1 pb-1.5 text-xs text-muted">
                        <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                        התוכן נעול — התקבלו תשובות. את התאריך עדיין ניתן לשנות.
                      </p>
                    )}
                  </div>
                </>
              );
              // Open: a full card, prominent. Closed: folded to one summary
              // line — a green check, the title, the tally — expanding to the
              // same card with every action (reopen, delete, read) intact.
              if (open) {
                return (
                  <div key={q.id} className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                    {inner}
                  </div>
                );
              }
              return (
                <details key={q.id} data-folded-query className="rounded-xl border border-border/70 bg-card shadow-sm">
                  <summary className="flex cursor-pointer select-none flex-wrap items-center gap-2 px-4 py-2.5 text-sm hover:bg-stone-50">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" aria-hidden />
                    <span className="font-medium">{q.title}</span>
                    <span className="text-xs text-muted">
                      {answered}/{q.targets.length} הגיבו · עד {formatIsraeliDate(q.dueDate)}
                    </span>
                  </summary>
                  <div className="border-t border-border/70 p-4">{inner}</div>
                </details>
              );
            })
          )}
        </section>
      )}

      {showForMe && (
        <section className="space-y-3">
          <h2 className="font-semibold">שאילתות עבורי</h2>
          {received.length === 0 ? (
            <p className="text-muted">
              {query
                ? `אין שאילתות שקיבלת התואמות ל״${query}״.`
                : "לא התקבלו שאילתות. כשמפקד כלשהו יפנה אל המסגרת שלך — מלמעלה, מהצד או מלמטה — השאילתא תופיע כאן."}
            </p>
          ) : (
            receivedSorted.map((t) => {
              const open = isOpen(t.query);
              const inner = (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span className="font-semibold">{t.query.title}</span>
                      <StatusPill open={open} closedEarly={!!t.query.closedAt} />
                      {!t.answer && open && (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">ממתין לתשובתך</span>
                      )}
                    </span>
                    <span className="text-xs text-muted">
                      מאת {senderLabel(t.query, resolve(t.query.senderNodeId))} · עד {formatIsraeliDate(t.query.dueDate)}
                      {t.query.dueChangedAt && ` · התאריך עודכן ${fmtDate(t.query.dueChangedAt)}`}
                      {t.query.closedAt && ` · נסגרה על ידי השולח ${fmtDate(t.query.closedAt)}`}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-muted">
                    <MentionText text={t.query.body} directory={directory} />
                  </div>

                  {open ? (
                    <form action={answerQuery} className="mt-3 space-y-2">
                      <input type="hidden" name="queryId" value={t.queryId} />
                      <MentionTextarea name="answer" people={mentionable} defaultValue={t.answer ?? ""} required rows={4} className={`${inputCls} w-full`} />
                      <div className="flex items-center gap-3">
                        <button className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
                          {t.answer ? "עדכן תשובה" : "שלח תשובה"}
                        </button>
                        {t.answeredAt && (
                          <span className="text-xs text-muted">
                            נשלח {fmtDate(t.answeredAt)}
                            {t.updatedAt && ` · עודכן ${fmtDate(t.updatedAt)}`}
                          </span>
                        )}
                      </div>
                    </form>
                  ) : (
                    <div className="mt-3 rounded bg-slate-50 p-2 text-sm">
                      {t.answer ? (
                        <>
                          <MentionText text={t.answer} directory={directory} />
                          <p className="mt-1 text-xs text-muted">
                            {t.query.closedAt ? "השאילתא נסגרה — לא ניתן עוד לערוך." : "התאריך עבר — לא ניתן עוד לערוך."}
                          </p>
                        </>
                      ) : (
                        <p className="text-muted">
                          {t.query.closedAt ? "השאילתא נסגרה ולא נשלחה תשובה." : "התאריך עבר ולא נשלחה תשובה."}
                        </p>
                      )}
                    </div>
                  )}
                </>
              );
              if (open) {
                return (
                  <div key={t.id} className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                    {inner}
                  </div>
                );
              }
              return (
                <details key={t.id} data-folded-query className="rounded-xl border border-border/70 bg-card shadow-sm">
                  <summary className="flex cursor-pointer select-none flex-wrap items-center gap-2 px-4 py-2.5 text-sm hover:bg-stone-50">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" aria-hidden />
                    <span className="font-medium">{t.query.title}</span>
                    <span className="text-xs text-muted">
                      {t.answer ? "נענתה" : "לא נענתה"} · עד {formatIsraeliDate(t.query.dueDate)}
                    </span>
                  </summary>
                  <div className="border-t border-border/70 p-4">{inner}</div>
                </details>
              );
            })
          )}
        </section>
      )}
      </div>
    </div>
  );
}

function StatusPill({ open, closedEarly }: { open: boolean; closedEarly: boolean }) {
  return (
    <span className={`rounded px-2 py-0.5 text-xs ${open ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}`}>
      {open ? "פתוחה" : closedEarly ? "נסגרה" : "סגורה"}
    </span>
  );
}
