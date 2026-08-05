import { mkdtemp, writeFile, rm, mkdir, copyFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { prisma } from "@/lib/prisma";
import type { Visibility } from "@/lib/access";
import { computePersonGaps, GAP_META } from "@/lib/gaps";
import { KIND_LABEL } from "@/lib/org";
import { STATUS_LABEL } from "@/lib/people";
import { addMonths, formatIsraeliDate, todayMarker } from "@/lib/dates";
import { stripMentions } from "@/lib/mentions";
import { scoreLabel } from "@/lib/eval-scale";
import { resolveUpload } from "@/lib/storage";
import { extractTextFromFile } from "@/lib/doc-text";

/**
 * Export a read-only snapshot of the career data — clipped to the user's
 * visibility — into a fresh temp dir. The agent works only on this copy:
 * scope inheritance and read-only-ness are enforced structurally.
 *
 * TWO SCOPES, and they are not the same shape:
 *
 *   career data  → clipped by `visibility` (the org tree, via access grants)
 *   queries      → clipped by `userId` (the command chain, via who asked whom)
 *
 * A commander can see a whole domain's career data and still have no business
 * reading an exchange between that domain and its sections. So the second scope
 * takes a user, not a Visibility, and it is deliberately NOT folded into
 * `Visibility` — the moment it is, the narrower rule inherits the wider one's
 * reach. `userId` is required rather than optional so that a call site which
 * forgets it fails to compile instead of silently shipping no queries.
 */
export async function exportScopedSnapshot(visibility: Visibility, today: Date, userId: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "agent-snap-"));

  const teamIds = [...visibility.nodeIds];
  const [nodes, people] = await Promise.all([
    prisma.orgNode.findMany(),
    prisma.person.findMany({
      where: { teamId: { in: teamIds } },
      include: {
        fieldValues: { include: { field: true } },
        pointProgress: true,
        metricReadings: true,
        evalEntries: { include: { attachments: true, recurringEvent: true } },
        assignedPlan: {
          include: {
            pointEvents: true,
            cumulativeMetrics: { include: { checkpoints: true } },
            recurringEvents: true,
            assignment: { select: { waiverOffsetMonths: true, waivers: true, assignedAt: true } },
          },
        },
        // so the agent can answer questions about plans a person used to be on
        planAssignments: {
          where: { endedAt: { not: null } },
          orderBy: { assignedAt: "desc" },
          select: { templateName: true, assignedAt: true, endedAt: true, reason: true },
        },
      },
    }),
  ]);

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const pathOf = (teamId: string | null): string => {
    if (!teamId) return "ללא שיוך";
    const parts: string[] = [];
    let cur = byId.get(teamId);
    while (cur) {
      parts.unshift(cur.name);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return parts.join(" ▸ ");
  };

  // Visible org tree
  const visibleNodes = nodes
    .filter((n) => visibility.nodeIds.has(n.id))
    .map((n) => ({ name: n.name, kind: KIND_LABEL[n.kind], path: pathOf(n.id) }));

  // Attachments are converted to TEXT for the agent (see design D1): a
  // text-only model cannot read binaries, and reading them would otherwise
  // require giving the agent script execution. The original is copied too,
  // but `people.json` points at the .txt sidecar.
  const attachmentRel = new Map<string, string>(); // attachment id -> relative .txt path
  for (const p of people) {
    for (const e of p.evalEntries) {
      for (const a of e.attachments) {
        const abs = resolveUpload(a.storagePath);
        if (!abs) continue;
        const personDir = p.fullName.replace(/[/\\]/g, "_");
        const safeName = a.filename.replace(/[/\\]/g, "_");
        const baseRel = path.join("files", personDir, `${a.id.slice(-6)}-${safeName}`);
        await mkdir(path.dirname(path.join(dir, baseRel)), { recursive: true });
        await copyFile(abs, path.join(dir, baseRel));

        const { text, method, note } = await extractTextFromFile(abs, a.filename);
        if (text.trim()) {
          const textRel = `${baseRel}.txt`;
          const header = `# ${a.filename}\n# חולץ בשיטת: ${method === "ocr" ? "OCR (מסמך סרוק)" : "טקסט מקורי"}\n\n`;
          await writeFile(path.join(dir, textRel), header + text, "utf8");
          attachmentRel.set(a.id, textRel);
        } else {
          const textRel = `${baseRel}.txt`;
          await writeFile(path.join(dir, textRel), `# ${a.filename}\n# ${note ?? "לא ניתן לחלץ טקסט מקובץ זה."}\n`, "utf8");
          attachmentRel.set(a.id, textRel);
        }
      }
    }
  }

  // People with plan, progress, gaps, and evaluation text
  const peopleOut = people.map((p) => {
    const gaps = computePersonGaps(p, today);
    return {
      שם: p.fullName,
      מסגרת: pathOf(p.teamId),
      // ISO on purpose: this is a machine interface. The UI is dd/mm/yyyy, but
      // a snapshot the agent reasons over must have no reading convention to
      // get wrong — and the agent is told, in the extraction prompt, that the
      // DOCUMENTS it reads are day-first.
      תאריך_גיוס: p.recruitmentDate.toISOString().slice(0, 10),
      // the plan's origin — every תאריך_יעד below is measured from THIS date
      תאריך_הצבה_ביחידה: p.placementDate.toISOString().slice(0, 10),
      סטטוס: STATUS_LABEL[p.status],
      סיום_שירות: p.endOfServiceDate?.toISOString().slice(0, 10) ?? null,
      פרטים_נוספים: Object.fromEntries(p.fieldValues.map((fv) => [fv.field.label, fv.value])),
      מסלולים_קודמים: p.planAssignments.map((a) => ({
        שם_תכנית: a.templateName,
        משויך_מ: a.assignedAt.toISOString().slice(0, 10),
        עד: a.endedAt?.toISOString().slice(0, 10) ?? null,
        סיבת_מעבר: a.reason,
      })),
      תכנית: p.assignedPlan
        ? {
            שם_תכנית: p.assignedPlan.name,
            פטור_עד_חודש: p.assignedPlan.assignment?.waiverOffsetMonths ?? 0,
            אירועים_נקודתיים: p.assignedPlan.pointEvents.map((e) => {
              const prog = p.pointProgress.find((x) => x.pointEventId === e.id);
              return {
                אירוע: e.label,
                תאריך_יעד: addMonths(p.placementDate, e.offsetMonths).toISOString().slice(0, 10),
                הושלם: !!prog,
                תאריך_ביצוע: prog?.doneOn.toISOString().slice(0, 10) ?? null,
                הערה: prog?.note ?? null,
              };
            }),
            מדדים_מצטברים: p.assignedPlan.cumulativeMetrics.map((m) => {
              const reading = p.metricReadings.find((r) => r.metricId === m.id);
              return {
                מדד: m.name,
                יחידה: m.unit,
                יעדים: m.checkpoints.map((c) => ({
                  יעד: c.target,
                  עד_תאריך: addMonths(p.placementDate, c.offsetMonths).toISOString().slice(0, 10),
                })),
                ערך_בפועל: reading?.value ?? null,
                נכון_לתאריך: reading?.asOf.toISOString().slice(0, 10) ?? null,
                הערה: reading?.note ?? null,
              };
            }),
          }
        : null,
      פערים: gaps.items.map((it) => ({
        פריט: it.label,
        סוג: it.kind,
        מצב: GAP_META[it.level].label,
        תאריך_יעד: it.dueDate.toISOString().slice(0, 10),
        פירוט: it.detail,
      })),
      מצב_כללי: gaps.status ? GAP_META[gaps.status].label : "אין תכנית",
      חוות_דעת_ואירועים: p.evalEntries.map((e) => ({
        כותרת: e.title,
        תוכן: e.content,
        // the kind and the assessment are here because the agent is the only
        // surface that aggregates across people — structuring an assessment and
        // then hiding it from the thing that can answer "מי קיבל ראיון מתחת
        // למצופה השנה" would defeat the reason for structuring it
        סוג: e.recurringEventId ? "מופע מהתכנית" : e.kind === "INTERVIEW" ? "סיכום ראיון" : "רשומה חופשית",
        הערכה: scoreLabel(e.score), // the label, never a bare number
        // the date the event HAPPENED, not when it was typed
        תאריך: e.eventDate.toISOString().slice(0, 10),
        נרשם_בתאריך: e.createdAt.toISOString().slice(0, 10),
        קבצים: e.attachments.map((a) => ({
          שם_קובץ: a.filename,
          נתיב: attachmentRel.get(a.id) ?? null, // readable copy inside the snapshot
        })),
      })),
    };
  });

  await writeFile(path.join(dir, "org.json"), JSON.stringify(visibleNodes, null, 2), "utf8");
  await writeFile(path.join(dir, "people.json"), JSON.stringify(peopleOut, null, 2), "utf8");
  const queriesOut = await exportQueries(userId, today);
  await writeFile(path.join(dir, "queries.json"), JSON.stringify(queriesOut, null, 2), "utf8");
  await writeFile(
    path.join(dir, "README.md"),
    [
      "# נתוני קריירה (עותק לקריאה בלבד)",
      "",
      `נכון לתאריך: ${today.toISOString().slice(0, 10)}`,
      "",
      "- `org.json` — המסגרות שבראות המשתמש (מרכז ▸ תחום ▸ מדור ▸ צוות).",
      "- `people.json` — האנשים שבראות: פרטים, תכנית קריירה, התקדמות, פערים, חוות דעת.",
      "- `files/` — תוכן הקבצים המצורפים לחוות הדעת, כטקסט מחולץ (.txt). הנתיב מופיע בשדה `נתיב` ב-people.json — קרא אותו כשהשאלה נוגעת לתוכן הקובץ. אין צורך (ואין אפשרות) להריץ סקריפטים: הטקסט כבר חולץ.",
      "- `queries.json` — שאילתות המפקד של המשתמש עצמו: מה שלח למסגרות שתחתיו ומה נשאל מלמעלה, על תשובותיהן.",
      "",
      "הנתונים כוללים רק את מה שהמשתמש המפעיל רשאי לראות.",
      "שים לב: `queries.json` נחתך אחרת מן השאר — לפי שרשרת הפיקוד ולא לפי ההיררכיה. שאילתא בין מסגרות אחרות אינה כאן גם אם הן בראות המשתמש, וזה נכון ולא חסר.",
    ].join("\n"),
    "utf8",
  );

  return dir;
}

/**
 * The user's own commander queries — what their framework asked, and what it
 * was asked. Nothing else: not a sibling's answer, not an exchange one level
 * down, and not another user's queries even for the Admin. The same rule the
 * page enforces, applied to the copy the agent reasons over.
 */
async function exportQueries(userId: string, today: Date) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { commandsNodeId: true } });
  const mine = user?.commandsNodeId;
  if (!mine) return { שאילתות_ששלחתי: [], שאילתות_שקיבלתי: [] };

  const open = (due: Date) => (todayMarker(today).getTime() <= due.getTime() ? "פתוחה" : "סגורה");

  const [sent, received] = await Promise.all([
    prisma.query.findMany({
      where: { senderNodeId: mine },
      orderBy: { createdAt: "desc" },
      include: { targets: { include: { node: { select: { name: true } }, answeredBy: { select: { name: true } } } } },
    }),
    prisma.queryTarget.findMany({
      where: { nodeId: mine },
      orderBy: { query: { createdAt: "desc" } },
      include: { query: { include: { sender: { select: { name: true } } } } },
    }),
  ]);

  return {
    שאילתות_ששלחתי: sent.map((q) => ({
      כותרת: q.title,
      // tags flattened to plain `@name`: the agent reads this text, it does not
      // render it, and raw `@[name](id)` would only get quoted back at the user
      תוכן: stripMentions(q.body),
      תאריך_אחרון: formatIsraeliDate(q.dueDate),
      מצב: open(q.dueDate),
      נשלחה: formatIsraeliDate(q.createdAt),
      נמענים: q.targets.map((t) => ({
        מסגרת: t.node.name,
        הגיב: !!t.answer,
        תשובה: stripMentions(t.answer),
        משיב: t.answeredBy?.name ?? null,
        מועד_תשובה: t.answeredAt ? formatIsraeliDate(t.answeredAt) : null,
        עודכן: t.updatedAt ? formatIsraeliDate(t.updatedAt) : null,
      })),
    })),
    שאילתות_שקיבלתי: received.map((t) => ({
      כותרת: t.query.title,
      תוכן: stripMentions(t.query.body),
      מאת: t.query.sender.name,
      תאריך_אחרון: formatIsraeliDate(t.query.dueDate),
      מצב: open(t.query.dueDate),
      התשובה_שלי: stripMentions(t.answer),
      מועד_תשובה: t.answeredAt ? formatIsraeliDate(t.answeredAt) : null,
      עודכן: t.updatedAt ? formatIsraeliDate(t.updatedAt) : null,
    })),
  };
}

export async function removeSnapshot(dir: string) {
  await rm(dir, { recursive: true, force: true });
}
