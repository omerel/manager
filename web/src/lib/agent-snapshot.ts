import { mkdtemp, writeFile, rm, mkdir, copyFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { prisma } from "@/lib/prisma";
import type { Visibility } from "@/lib/access";
import { computePersonGaps, GAP_META } from "@/lib/gaps";
import { KIND_LABEL } from "@/lib/org";
import { STATUS_LABEL } from "@/lib/people";
import { addMonths } from "@/lib/dates";
import { resolveUpload } from "@/lib/storage";
import { extractTextFromFile } from "@/lib/doc-text";

/**
 * Export a read-only snapshot of the career data — clipped to the user's
 * visibility — into a fresh temp dir. The agent works only on this copy:
 * scope inheritance and read-only-ness are enforced structurally.
 */
export async function exportScopedSnapshot(visibility: Visibility, today: Date): Promise<string> {
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
        תאריך: e.createdAt.toISOString().slice(0, 10),
        קבצים: e.attachments.map((a) => ({
          שם_קובץ: a.filename,
          נתיב: attachmentRel.get(a.id) ?? null, // readable copy inside the snapshot
        })),
      })),
    };
  });

  await writeFile(path.join(dir, "org.json"), JSON.stringify(visibleNodes, null, 2), "utf8");
  await writeFile(path.join(dir, "people.json"), JSON.stringify(peopleOut, null, 2), "utf8");
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
      "",
      "הנתונים כוללים רק את מה שהמשתמש המפעיל רשאי לראות.",
    ].join("\n"),
    "utf8",
  );

  return dir;
}

export async function removeSnapshot(dir: string) {
  await rm(dir, { recursive: true, force: true });
}
