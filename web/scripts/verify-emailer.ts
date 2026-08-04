/**
 * Verification for email-reports and email-title-and-boolean-result.
 *
 * The centre of this suite is the crash cases. The verdict moved from the exit
 * code to stdout precisely because a crashing Python script exits 1, so the
 * assertions that matter are the ones proving an exit code of 1 does NOT read
 * as a delivered message.
 *
 *   npx tsx scripts/verify-emailer.ts
 */
import { execFile } from "child_process";
import { readFileSync, writeFileSync, renameSync, rmSync } from "fs";
import { promisify } from "util";
import { sendReport } from "../src/lib/emailer";
import { subjectFromReport } from "../src/lib/report-subject";

const run = promisify(execFile);

let failures = 0;
let checks = 0;
function check(label: string, ok: boolean, detail = "") {
  checks++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

const SCRIPT = "docker/emailer.py";
const ASIDE = "docker/emailer.py.aside";

/** Swap in a throwaway script, run fn, always restore. */
async function withScript(source: string, fn: () => Promise<void>) {
  renameSync(SCRIPT, ASIDE);
  try {
    writeFileSync(SCRIPT, source);
    await fn();
  } finally {
    rmSync(SCRIPT, { force: true });
    renameSync(ASIDE, SCRIPT);
  }
}

async function contract() {
  console.log("\n=== the script's contract: 1/0 on the last line, exit 0 ===");
  const call = async (force: string) => {
    try {
      const r = await run("python3", [SCRIPT, "--title", "כותרת", "--body", "גוף הדוח", "--to", "u@example.invalid"], {
        env: { ...process.env, EMAILER_FORCE: force },
      });
      return { code: 0, stdout: r.stdout };
    } catch (e) {
      const err = e as { code?: number; stdout?: string };
      return { code: Number(err.code), stdout: err.stdout ?? "" };
    }
  };
  const last = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean).pop() ?? "";

  const sent = await call("sent");
  check("forced sent exits 0", sent.code === 0, String(sent.code));
  check("and prints 1 as its LAST line", last(sent.stdout) === "1", JSON.stringify(last(sent.stdout)));
  check("with diagnostics before it — the last-line rule is exercised by the shipped file",
    sent.stdout.includes("to=u@example.invalid") && sent.stdout.trim().split("\n").length > 1);

  const failed = await call("failed");
  check("forced failed also exits 0", failed.code === 0, String(failed.code));
  check("and prints 0 as its last line", last(failed.stdout) === "0", JSON.stringify(last(failed.stdout)));

  const src = readFileSync(SCRIPT, "utf8");
  check("the file states the 1/0 contract", src.includes("LAST non-empty line") && src.includes("`1` (sent) or `0` (failed)"));
  check("it still says the target environment replaces it", src.includes("STAND-IN") && src.includes("replaces it"));
  check("and no longer documents the abandoned 201 convention", !src.includes("201") && !src.includes("457"));
}

async function mapping() {
  console.log("\n=== how the caller reads it ===");
  process.env.EMAILER_FORCE = "sent";
  check("forced success → ok", (await sendReport({ title: "t", body: "גוף", to: "a@b.c" })).ok === true);
  process.env.EMAILER_FORCE = "failed";
  const f = await sendReport({ title: "t", body: "גוף", to: "a@b.c" });
  check("forced failure → not ok, with a reason", f.ok === false && !!(f as { reason: string }).reason);

  process.env.EMAILER_FORCE = "sent";
  check("no address → not ok", (await sendReport({ title: "t", body: "גוף", to: "" })).ok === false);
  check("empty body → not ok", (await sendReport({ title: "t", body: "  ", to: "a@b.c" })).ok === false);

  // the byte limit, unchanged by this change but still load-bearing
  const over = "א".repeat(70_000);
  check("140,000-byte Hebrew body still refused", (await sendReport({ title: "t", body: over, to: "a@b.c" })).ok === false);
}

async function crashes() {
  console.log("\n=== the crash cases — the reason the verdict left the exit code ===");
  process.env.EMAILER_FORCE = "sent";

  await withScript('raise ValueError("the mail API is unreachable")\n', async () => {
    const r = await sendReport({ title: "t", body: "גוף", to: "a@b.c" });
    check("a script that RAISES (exit 1) reads as FAILED, not sent", r.ok === false,
      (r as { reason?: string }).reason?.slice(0, 60) ?? "ok:true");
  });

  await withScript('import sys\nsys.exit(1)\n', async () => {
    const r = await sendReport({ title: "t", body: "גוף", to: "a@b.c" });
    check("a bare exit(1) reads as FAILED — the whole point of the move", r.ok === false);
  });

  await withScript('print("ran, but said nothing useful")\n', async () => {
    const r = await sendReport({ title: "t", body: "גוף", to: "a@b.c" });
    check("ran cleanly but printed no verdict → FAILED", r.ok === false,
      (r as { reason?: string }).reason?.slice(0, 70) ?? "");
  });

  await withScript('print("maybe")\n', async () => {
    const r = await sendReport({ title: "t", body: "גוף", to: "a@b.c" });
    check("an unreadable verdict → FAILED, not guessed", r.ok === false);
  });

  await withScript('print("log line")\nprint("another")\nprint("1")\n', async () => {
    const r = await sendReport({ title: "t", body: "גוף", to: "a@b.c" });
    check("logs then 1 → SENT (the last line wins)", r.ok === true, (r as { reason?: string }).reason ?? "");
  });

  await withScript('print("1")\nprint("trailing noise")\n', async () => {
    const r = await sendReport({ title: "t", body: "גוף", to: "a@b.c" });
    check("1 followed by noise → FAILED (the verdict must be last)", r.ok === false);
  });

  // missing script
  renameSync(SCRIPT, ASIDE);
  try {
    const r = await sendReport({ title: "t", body: "גוף", to: "a@b.c" });
    check("a missing script → FAILED, naming it", r.ok === false &&
      (r as { reason: string }).reason.includes("emailer.py"), (r as { reason?: string }).reason ?? "");
  } finally {
    renameSync(ASIDE, SCRIPT);
  }
}

function subjects() {
  console.log("\n=== the subject is the report's own first line ===");
  const cases: [string, string, string][] = [
    ["# אנשים במרכז המחקר\n\nשורה", "תשובה", "אנשים במרכז המחקר"],
    ["## כמה אנשים עם פערים?\n", "תשובה", "כמה אנשים עם פערים?"],
    ["**נכון לתאריך: 2026-08-02**\n\n- עמר", "תשובה", "נכון לתאריך: 2026-08-02"],
    ["הנתונים נקראו. להלן הדוח.", "דוח", "הנתונים נקראו. להלן הדוח."],
    ["\n\n   \n# אחרי שורות ריקות", "תשובה", "אחרי שורות ריקות"],
    ["", "תשובה", "תשובה"],
    ["   \n\n  ", "דוח פערים", "דוח פערים"],
    ["###   \n", "תשובה", "תשובה"], // nothing left after the markers
    ["> ציטוט בתחילת הדוח", "תשובה", "ציטוט בתחילת הדוח"],
  ];
  for (const [body, fallback, want] of cases) {
    const got = subjectFromReport(body, fallback);
    check(`${JSON.stringify(body.slice(0, 28))} → ${JSON.stringify(want)}`, got === want, JSON.stringify(got));
  }
  const long = "מ".repeat(400);
  const capped = subjectFromReport(long, "x");
  check("a 400-character line is capped", capped.length <= 121, `${capped.length} chars`);
  check("and marked as cut", capped.endsWith("…"));
}

async function main() {
  await contract();
  await mapping();
  await crashes();
  subjects();
  console.log(failures === 0 ? `\nall ${checks} checks passed` : `\nFAILED — ${checks} ran, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

main();
