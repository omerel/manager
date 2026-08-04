import { execFile } from "child_process";
import path from "path";

/**
 * Send a produced report by email, through `docker/emailer.py`.
 *
 * The script is a stand-in that the target environment replaces; the contract
 * is the three flags and exit code 201 for sent. Nothing here depends on how
 * delivery actually happens.
 *
 * Never throws. A send is an addition to an action that already succeeded —
 * the user's answer exists whether or not the mail went out — so the outcome is
 * returned and the caller decides where to show it.
 */

export type SendResult = { ok: true } | { ok: false; reason: string };

const SENT_CODE = 201;
const TIMEOUT_MS = 30_000;

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
      (err, _stdout, stderr) => {
        // success is exactly 201; every other outcome is a failure with a reason
        // an operator can act on
        if (!err) return resolve({ ok: false, reason: "שליחת המייל נכשלה (הסקריפט לא החזיר 201)." });

        // execFile reports a non-zero exit as `code`, typed as string but a
        // number at runtime for a plain exit status — compare loosely on purpose
        const e = err as Error & { code?: number | string; killed?: boolean };
        if (Number(e.code) === SENT_CODE) return resolve({ ok: true });
        if (e.code === "ENOENT") {
          return resolve({ ok: false, reason: "שליחת המייל נכשלה: python3 או docker/emailer.py לא נמצאו." });
        }
        if (e.killed) return resolve({ ok: false, reason: "שליחת המייל נכשלה: הסקריפט לא הסתיים בזמן." });
        const detail = (stderr || "").trim().split("\n").pop() ?? "";
        return resolve({
          ok: false,
          reason: `שליחת המייל נכשלה (קוד ${String(e.code ?? "לא ידוע")})${detail ? ` — ${detail}` : ""}.`,
        });
      },
    );
  });
}
