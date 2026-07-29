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
          },
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

  // Copy attachment files into the snapshot (files/<person>/<filename>) so the
  // agent can Read their contents — still a copy, still read-only.
  const filesRoot = path.join(dir, "files");
  const attachmentRel = new Map<string, string>(); // attachment id -> relative path
  for (const p of people) {
    for (const e of p.evalEntries) {
      for (const a of e.attachments) {
        const abs = resolveUpload(a.storagePath);
        if (!abs) continue;
        const personDir = p.fullName.replace(/[/\\]/g, "_");
        const rel = path.join("files", personDir, `${a.id.slice(-6)}-${a.filename.replace(/[/\\]/g, "_")}`);
        await mkdir(path.dirname(path.join(dir, rel)), { recursive: true });
        await copyFile(abs, path.join(dir, rel));
        attachmentRel.set(a.id, rel);
      }
    }
  }
  void filesRoot;

  // People with plan, progress, gaps, and evaluation text
  const peopleOut = people.map((p) => {
    const gaps = computePersonGaps(p, today);
    return {
      שם: p.fullName,
      מסגרת: pathOf(p.teamId),
      תאריך_גיוס: p.recruitmentDate.toISOString().slice(0, 10),
      סטטוס: STATUS_LABEL[p.status],
      סיום_שירות: p.endOfServiceDate?.toISOString().slice(0, 10) ?? null,
      פרטים_נוספים: Object.fromEntries(p.fieldValues.map((fv) => [fv.field.label, fv.value])),
      תכנית: p.assignedPlan
        ? {
            שם_תכנית: p.assignedPlan.name,
            אירועים_נקודתיים: p.assignedPlan.pointEvents.map((e) => {
              const prog = p.pointProgress.find((x) => x.pointEventId === e.id);
              return {
                אירוע: e.label,
                תאריך_יעד: addMonths(p.recruitmentDate, e.offsetMonths).toISOString().slice(0, 10),
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
                  עד_תאריך: addMonths(p.recruitmentDate, c.offsetMonths).toISOString().slice(0, 10),
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
      "- `files/` — עותקי הקבצים המצורפים לחוות הדעת; הנתיב של כל קובץ מופיע בשדה `נתיב` ב-people.json. קרא אותם כשהשאלה נוגעת לתוכנם.",
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
