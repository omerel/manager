import { execFile } from "child_process";
import path from "path";

/**
 * Send a produced report by email, through `docker/emailer.py`.
 *
 * The script is a stand-in that the target environment replaces. The contract
 * is the three flags plus a verdict of `1` or `0` on the LAST non-empty line of
 * stdout; anything before it is diagnostics the script is free to log.
 *
 * Success requires BOTH a normal exit AND a printed `1`. The exit code is not
 * the verdict, and could not be: a crashing Python script exits 1 (an unhandled
 * exception and a syntax error both do), so an exit code of 1 meaning "sent"
 * would report every crash of a real implementation as a delivered message.
 * A verdict on stdout cannot be produced by accident — a script that dies
 * prints nothing, and that reads as failure without enumerating why.
 *
 * Never throws. A send is an addition to an action that already succeeded —
 * the user's answer exists whether or not the mail went out — so the outcome is
 * returned and the caller decides where to show it.
 */

export type SendResult = { ok: true } | { ok: false; reason: string };

const SENT = "1";
const FAILED = "0";
const TIMEOUT_MS = 30_000;

/** The verdict is the last non-empty line, so a script may log before it. */
function verdictOf(stdout: string): string | null {
  const lines = stdout.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.length ? lines[lines.length - 1] : null;
}

/**
 * Linux caps a SINGLE argument at MAX_ARG_STRLEN — 32 pages, 131,072 bytes,
 * with 131,071 the largest that passes. Measured by bisection on this platform.
 *
 * This is not ARG_MAX (2 MB here); checking that one and concluding there is
 * room to spare is the easy mistake. And it must be counted in BYTES: Hebrew is
 * two bytes per character in UTF-8, so a 70,000-character Hebrew report is
 * 140,000 bytes — a `.length` check would wave it through, and the spawn would
 * then die with E2BIG.
 *
 * For scale, the largest report this system has produced is about 2 KB.
 */
const MAX_ARG_BYTES = 131_071;

const SCRIPT = path.join(process.cwd(), "docker", "emailer.py");

export async function sendReport({
  title,
  body,
  to,
}: {
  title: string;
  body: string;
  to: string;
}): Promise<SendResult> {
  if (!to) return { ok: false, reason: "לא הוגדרה כתובת מייל למשתמש." };
  if (!body.trim()) return { ok: false, reason: "אין תוכן לשליחה." };

  const bytes = Buffer.byteLength(body, "utf8");
  if (bytes > MAX_ARG_BYTES) {
    return {
      ok: false,
      reason: `הדוח ארוך מדי לשליחה (${bytes.toLocaleString()} בתים; המקסימום ${MAX_ARG_BYTES.toLocaleString()}). הורד אותו כקובץ.`,
    };
  }

  return new Promise<SendResult>((resolve) => {
    execFile(
      "python3",
      [SCRIPT, "--title", title, "--body", body, "--to", to],
      { timeout: TIMEOUT_MS, maxBuffer: 1024 * 1024 },
      (err, stdout, stderr) => {
        // the script did not run to completion: it crashed, was missing, or was
        // killed. It printed no verdict, so this is a failure whatever the code.
        if (err) {
          const e = err as Error & { code?: number | string; killed?: boolean };
          if (e.code === "ENOENT") {
            return resolve({ ok: false, reason: "שליחת המייל נכשלה: python3 או docker/emailer.py לא נמצאו." });
          }
          if (e.killed) return resolve({ ok: false, reason: "שליחת המייל נכשלה: הסקריפט לא הסתיים בזמן." });
          const detail = (stderr || "").trim().split("\n").pop() ?? "";
          return resolve({
            ok: false,
            reason: `שליחת המייל נכשלה (הסקריפט הסתיים בשגיאה ${String(e.code ?? "לא ידועה")})${detail ? ` — ${detail}` : ""}.`,
          });
        }

        const verdict = verdictOf(stdout ?? "");
        if (verdict === SENT) return resolve({ ok: true });
        if (verdict === FAILED) {
          const detail = (stderr || "").trim().split("\n").pop() ?? "";
          return resolve({ ok: false, reason: `שליחת המייל נכשלה${detail ? ` — ${detail}` : "."}` });
        }
        // ran cleanly but said nothing we understand — refused rather than guessed
        return resolve({
          ok: false,
          reason: `שליחת המייל נכשלה: הסקריפט לא החזיר 1 או 0${verdict ? ` (התקבל ״${verdict.slice(0, 40)}״)` : " (לא הודפס דבר)"}.`,
        });
      },
    );
  });
}
