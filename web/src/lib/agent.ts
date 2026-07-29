import { execFile } from "child_process";
import { prisma } from "@/lib/prisma";
import { computeVisibility, type SessionUser } from "@/lib/access";
import { exportScopedSnapshot, removeSnapshot } from "@/lib/agent-snapshot";

const RUN_TIMEOUT_MS = 240_000;

/**
 * Agent runtime: the machine's installed Claude CLI (`claude -p`), using its
 * own login — no per-user API keys. Runs are sandboxed to a scoped snapshot.
 */
function runClaude(prompt: string, cwd: string, timeoutMs = RUN_TIMEOUT_MS): Promise<{ output: string }> {
  const args = [
    "-p",
    prompt,
    "--output-format",
    "json",
    // Read-only toolset over the snapshot copy; no Bash, no Write, no network.
    "--allowedTools",
    "Read,Grep,Glob",
    "--max-turns",
    "30",
  ];
  if (process.env.AGENT_MODEL) args.push("--model", process.env.AGENT_MODEL);

  return new Promise((resolve, reject) => {
    const child = execFile(
      "claude",
      args,
      {
        cwd,
        timeout: timeoutMs,
        maxBuffer: 16 * 1024 * 1024,
        env: { ...process.env, CLAUDE_CODE_ENTRYPOINT: "manager-agent" },
      },
      (err, stdout, stderr) => {
        if (err && !stdout) {
          // strip the harmless stdin warning so real errors surface
          const clean = (stderr ?? "")
            .split("\n")
            .filter((l) => !l.includes("no stdin data received"))
            .join("\n")
            .trim();
          reject(new Error((clean || err.message).slice(0, 2000)));
          return;
        }
        try {
          const parsed = JSON.parse(stdout);
          if (parsed.is_error) {
            reject(new Error(String(parsed.result ?? "run failed").slice(0, 2000)));
          } else {
            resolve({ output: String(parsed.result ?? "") });
          }
        } catch {
          // non-JSON output — return raw text
          resolve({ output: stdout.trim() });
        }
      },
    );
    child.stdin?.end(); // no stdin — avoid the CLI's 3s wait-for-stdin stall
  });
}

const CHAT_INSTRUCTIONS = `אתה עוזר ניתוח לקריאה-בלבד של מערכת ניהול קריירה.
בתיקייה הנוכחית: README.md, org.json, people.json, ותיקיית files/ — קרא אותם כדי לענות.
כללים מחייבים:
- ענה בעברית, תמציתי וברור, בפורמט Markdown (כותרות, הדגשות, רשימות וטבלאות כשמתאים).
- כל תשובה חייבת לכלול ראיות: שמות האנשים/הרשומות שממנה נגזרה, לא רק מספר.
- כשהשאלה נוגעת לחוות דעת או למסמכים — קרא גם את תוכן הקבצים המצורפים (הנתיבים בשדה "נתיב" ב-people.json, תחת files/).
- ציין את התאריך שאליו הנתונים נכונים (מופיע ב-README).
- אם השאלה חורגת מהנתונים שבקבצים — אמור זאת במפורש.
- אל תמציא נתונים.

שאלת המשתמש:`;

/** Public wrapper for other engines (rules) — same sandboxed runner. */
export function runClaudeRaw(prompt: string, cwd: string, timeoutMs?: number): Promise<{ output: string }> {
  return runClaude(prompt, cwd, timeoutMs);
}

/**
 * Extract card-field values from a document in `dir` (written by materializeDocument).
 * Returns raw proposals [{key, proposed}] — the caller merges with current values;
 * nothing is written to the person here.
 */
export async function runExtraction(
  dir: string,
  docName: string,
  fields: { key: string; label: string; type: string; options?: string[] }[],
): Promise<{ key: string; proposed: string }[]> {
  const prompt = `אתה מחלץ נתונים ממסמך לכרטיס עובד.
בתיקייה הנוכחית: ${docName} — קרא אותו.
השדות לחיפוש (key · תיאור · סוג):
${fields
  .map((f) => `- ${f.key} · ${f.label} · ${f.type}${f.options?.length ? ` · ערכים מותרים: [${f.options.join(", ")}]` : ""}`)
  .join("\n")}

כללים:
- החזר אך ורק JSON תקין, בלי טקסט נוסף: [{"key":"...","proposed":"..."}]
- כלול רק שדות שמצאת להם ערך מפורש במסמך. אל תנחש ואל תמציא.
- תאריכים בפורמט YYYY-MM-DD.
- לשדות עם ערכים מותרים — הצע רק ערך מהרשימה (או אל תכלול את השדה).`;

  const { output } = await runClaude(prompt, dir);
  // the model may wrap the JSON in a fence — extract the first array
  const match = output.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x) => x && typeof x.key === "string" && typeof x.proposed === "string" && x.proposed.trim())
      .map((x) => ({ key: x.key, proposed: String(x.proposed).trim() }));
  } catch {
    return [];
  }
}

/** Execute a chat question against an existing job row (background-safe). */
export async function executeChatJob(user: SessionUser, question: string, runId: string): Promise<void> {
  const started = Date.now();
  const visibility = await computeVisibility(user);
  const dir = await exportScopedSnapshot(visibility, new Date());
  try {
    const { output } = await runClaude(`${CHAT_INSTRUCTIONS}\n${question}`, dir);
    await prisma.agentRun.update({
      where: { id: runId },
      data: { status: "SUCCEEDED", output, durationMs: Date.now() - started },
    });
  } catch (e) {
    await prisma.agentRun.update({
      where: { id: runId },
      data: { status: "FAILED", error: e instanceof Error ? e.message : String(e), durationMs: Date.now() - started },
    });
  } finally {
    await removeSnapshot(dir);
  }
}
