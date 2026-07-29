import { execFile } from "child_process";
import { writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { computeVisibility, type SessionUser } from "@/lib/access";
import { exportScopedSnapshot, removeSnapshot } from "@/lib/agent-snapshot";
import { runClaudeRaw } from "@/lib/agent";
import type { Rule } from "@/generated/prisma/client";

const SCRIPT_TIMEOUT_MS = 60_000;

const RULE_INSTRUCTIONS = `אתה מריץ "חוק" של מערכת ניהול קריירה — משימת ניתוח לקריאה-בלבד שמפיקה דוח.
בתיקייה הנוכחית: README.md, org.json, people.json, ותיקיית files/ — קרא אותם.
כללים מחייבים:
- הפק דוח בעברית בפורמט Markdown, ברור ומסודר.
- כלול ראיות: שמות אנשים/רשומות, לא רק מספרים.
- ציין את תאריך הנתונים (מופיע ב-README).
- אל תמציא נתונים.

החוק להרצה:`;

/** Run a Node script (a pinned SCRIPT realization) inside the snapshot dir. */
function runNodeScript(scriptSource: string, cwd: string, todayIso: string): Promise<{ output: string }> {
  return new Promise((resolve, reject) => {
    const file = path.join(cwd, "__rule-script.mjs");
    writeFile(file, scriptSource, "utf8").then(() => {
      execFile(
        "node",
        ["--no-warnings", file],
        { cwd, timeout: SCRIPT_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, TODAY: todayIso } },
        (err, stdout, stderr) => {
          if (err) reject(new Error((stderr || err.message).slice(0, 2000)));
          else resolve({ output: stdout.trim() });
        },
      );
    }, reject);
  });
}

/** Execute a rule for its owner. Handles pinned (script/flow) and unpinned runs. */
export async function executeRule(user: SessionUser, rule: Rule): Promise<string> {
  const run = await prisma.agentRun.create({
    data: { userId: user.id, kind: "RULE", ruleId: rule.id, prompt: rule.text, status: "RUNNING", pinnedRun: !!rule.pinnedAt },
  });

  const started = Date.now();
  const today = new Date();
  const visibility = await computeVisibility(user);
  const dir = await exportScopedSnapshot(visibility, today);
  try {
    let output: string;
    if (rule.pinnedAt && rule.realizationKind === "SCRIPT" && rule.realization) {
      // deterministic: no LLM at all
      ({ output } = await runNodeScript(rule.realization, dir, today.toISOString().slice(0, 10)));
    } else if (rule.pinnedAt && rule.realizationKind === "FLOW" && rule.realization) {
      const prompt = `אתה משחזר דוח לפי נוהל נעול. בתיקייה הנוכחית: org.json, people.json, files/ — הנתונים העדכניים.

הנוהל הנעול (חובה לפעול לפיו במדויק):
${rule.realization}

דוגמת הזהב — הפורמט, המבנה והסגנון המחייבים (הפק את אותו דוח בדיוק, רק עם הנתונים העדכניים):
---
${rule.goldenOutput ?? ""}
---

הפק את הדוח העדכני. אל תוסיף הערות מחוץ לדוח.`;
      ({ output } = await runClaudeRaw(prompt, dir));
    } else {
      ({ output } = await runClaudeRaw(`${RULE_INSTRUCTIONS}\n${rule.text}`, dir));
    }
    await prisma.agentRun.update({
      where: { id: run.id },
      data: { status: "SUCCEEDED", output, durationMs: Date.now() - started },
    });
  } catch (e) {
    await prisma.agentRun.update({
      where: { id: run.id },
      data: { status: "FAILED", error: e instanceof Error ? e.message : String(e), durationMs: Date.now() - started },
    });
  } finally {
    await removeSnapshot(dir);
  }
  await prisma.rule.update({ where: { id: rule.id }, data: {} }).catch(() => {});
  return run.id;
}

/**
 * Pin a rule to an approved output: the agent itself decides the realization —
 * a deterministic script when the task is computational, a locked flow when it
 * needs generation. The approved output becomes the golden example.
 */
export async function pinRule(user: SessionUser, rule: Rule, approvedOutput: string): Promise<void> {
  const visibility = await computeVisibility(user);
  const dir = await exportScopedSnapshot(visibility, new Date());
  try {
    const prompt = `משימת "קיבוע חוק" במערכת ניהול קריירה.
בתיקייה הנוכחית: org.json, people.json — מבנה הנתונים שהחוק רץ עליו (קרא אותם כדי להבין את הסכימה).

החוק המילולי:
${rule.text}

התוצר שהמשתמש אישר (דוגמת הזהב — כך בדיוק הוא רוצה לקבל את התוצר בכל ריצה עתידית):
---
${approvedOutput}
---

החלט איך לשחזר את התוצר נאמנה בריצות עתידיות, ובחר אחת:
1. אם התוצר חישובי במהותו (שליפה, סינון, ספירה, פורמט קבוע) — כתוב סקריפט Node.js (ESM) דטרמיניסטי:
   - קורא את org.json ו-people.json מהתיקייה הנוכחית (fs.readFileSync).
   - משתמש ב-process.env.TODAY (YYYY-MM-DD) כתאריך הנוכחי; בלי רשת ובלי תלויות חיצוניות.
   - מדפיס ל-stdout את הדוח בדיוק במבנה ובסגנון של דוגמת הזהב, מחושב מהנתונים העדכניים.
2. אם התוצר דורש ניסוח יצירתי שלא ניתן לקידוד — כתוב "נוהל נעול": רצף צעדים מדויק + תבנית פורמט מחייבת שישחזרו את הסגנון בכל ריצה.

פלט: JSON בלבד, בלי גדרות קוד: {"kind":"SCRIPT"|"FLOW","realization":"<הקוד או הנוהל>"}`;

    // pinning is a heavier meta-run (may author a full script) — give it more time
    const { output } = await runClaudeRaw(prompt, dir, 420_000);
    const match = output.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("הסוכן לא החזיר מימוש תקין.");
    const parsed = JSON.parse(match[0]) as { kind?: string; realization?: string };
    const kind = parsed.kind === "SCRIPT" ? "SCRIPT" : parsed.kind === "FLOW" ? "FLOW" : null;
    if (!kind || !parsed.realization) throw new Error("מימוש חסר או לא תקין.");

    // sanity: a SCRIPT must actually run and produce output against current data
    if (kind === "SCRIPT") {
      const test = await runNodeScript(parsed.realization, dir, new Date().toISOString().slice(0, 10));
      if (!test.output.trim()) throw new Error("הסקריפט שנוצר לא הפיק פלט.");
    }

    await prisma.rule.update({
      where: { id: rule.id },
      data: { pinnedAt: new Date(), realizationKind: kind, realization: parsed.realization, goldenOutput: approvedOutput },
    });
  } finally {
    await removeSnapshot(dir);
  }
}

/* ---------------- chronic scheduler (in-process, minute tick) ---------------- */

export function nextRunFrom(base: Date, schedule: "DAILY" | "WEEKLY" | "MONTHLY"): Date {
  const d = new Date(base);
  if (schedule === "DAILY") d.setUTCDate(d.getUTCDate() + 1);
  else if (schedule === "WEEKLY") d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

const globalScheduler = globalThis as unknown as { __ruleScheduler?: ReturnType<typeof setInterval> };

/** Lazy in-process scheduler: every minute, run rules whose nextRunAt is due. */
export function ensureScheduler() {
  if (globalScheduler.__ruleScheduler) return;
  globalScheduler.__ruleScheduler = setInterval(async () => {
    try {
      const due = await prisma.rule.findMany({
        where: { schedule: { not: "NONE" }, nextRunAt: { lte: new Date() } },
        include: { user: { include: { grants: true } } },
        take: 5,
      });
      for (const rule of due) {
        // advance first so a crash can't cause a tight re-run loop
        await prisma.rule.update({
          where: { id: rule.id },
          data: { nextRunAt: nextRunFrom(new Date(), rule.schedule as "DAILY" | "WEEKLY" | "MONTHLY") },
        });
        const owner: SessionUser = {
          id: rule.user.id,
          name: rule.user.name,
          role: rule.user.role,
          grants: rule.user.grants.map((g) => ({ nodeId: g.nodeId, level: g.level })),
        };
        await executeRule(owner, rule);
      }
    } catch {
      // scheduler must never crash the server
    }
  }, 60_000);
}
