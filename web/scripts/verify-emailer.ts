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
import { existsSync, readFileSync, writeFileSync, renameSync, rmSync } from "fs";
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
  check("forced success → ok", (await sendReport({ title: "t", body: "גוף", to: "a@b.c", from: "בודק (v@test)" })).ok === true);
  process.env.EMAILER_FORCE = "failed";
  const f = await sendReport({ title: "t", body: "גוף", to: "a@b.c", from: "בודק (v@test)" });
  check("forced failure → not ok, with a reason", f.ok === false && !!(f as { reason: string }).reason);

  process.env.EMAILER_FORCE = "sent";
  check("no address → not ok", (await sendReport({ title: "t", body: "גוף", to: "", from: "בודק (v@test)" })).ok === false);
  check("empty body → not ok", (await sendReport({ title: "t", body: "  ", to: "a@b.c", from: "בודק (v@test)" })).ok === false);

  // the byte limit, unchanged by this change but still load-bearing
  const over = "א".repeat(70_000);
  check("140,000-byte Hebrew body still refused", (await sendReport({ title: "t", body: over, to: "a@b.c", from: "בודק (v@test)" })).ok === false);
}

async function crashes() {
  console.log("\n=== the crash cases — the reason the verdict left the exit code ===");
  process.env.EMAILER_FORCE = "sent";

  await withScript('raise ValueError("the mail API is unreachable")\n', async () => {
    const r = await sendReport({ title: "t", body: "גוף", to: "a@b.c", from: "בודק (v@test)" });
    check("a script that RAISES (exit 1) reads as FAILED, not sent", r.ok === false,
      (r as { reason?: string }).reason?.slice(0, 60) ?? "ok:true");
  });

  await withScript('import sys\nsys.exit(1)\n', async () => {
    const r = await sendReport({ title: "t", body: "גוף", to: "a@b.c", from: "בודק (v@test)" });
    check("a bare exit(1) reads as FAILED — the whole point of the move", r.ok === false);
  });

  await withScript('print("ran, but said nothing useful")\n', async () => {
    const r = await sendReport({ title: "t", body: "גוף", to: "a@b.c", from: "בודק (v@test)" });
    check("ran cleanly but printed no verdict → FAILED", r.ok === false,
      (r as { reason?: string }).reason?.slice(0, 70) ?? "");
  });

  await withScript('print("maybe")\n', async () => {
    const r = await sendReport({ title: "t", body: "גוף", to: "a@b.c", from: "בודק (v@test)" });
    check("an unreadable verdict → FAILED, not guessed", r.ok === false);
  });

  await withScript('print("log line")\nprint("another")\nprint("1")\n', async () => {
    const r = await sendReport({ title: "t", body: "גוף", to: "a@b.c", from: "בודק (v@test)" });
    check("logs then 1 → SENT (the last line wins)", r.ok === true, (r as { reason?: string }).reason ?? "");
  });

  await withScript('print("1")\nprint("trailing noise")\n', async () => {
    const r = await sendReport({ title: "t", body: "גוף", to: "a@b.c", from: "בודק (v@test)" });
    check("1 followed by noise → FAILED (the verdict must be last)", r.ok === false);
  });

  // missing script
  renameSync(SCRIPT, ASIDE);
  try {
    const r = await sendReport({ title: "t", body: "גוף", to: "a@b.c", from: "בודק (v@test)" });
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

/**
 * The stand-in's send log — a scratch EMAILER_LOG per assertion set, so the
 * suite never touches (or depends on) a developer's accumulated mail.log.
 * These run against the REAL script: the throwaway scripts in withScript()
 * never log, which is itself asserted — the log is the stand-in's feature,
 * not part of the contract a replacement owes.
 */
async function sendLog() {
  console.log("\n=== the stand-in logs every send ===");
  const LOG = "docker/mail-verify.log";
  rmSync(LOG, { force: true });
  const env = { ...process.env, EMAILER_LOG: LOG };

  const call = (force: string, extra: string[] = []) =>
    run("python3", [SCRIPT, "--title", "דוח שבועי", "--body", "גוף", "--to", "dana@test", "--from", "עמר (o@test)", ...extra],
      { env: { ...env, EMAILER_FORCE: force } }).catch((e) => e as { stdout?: string });

  await call("sent");
  let lines = readFileSync(LOG, "utf8").trim().split("\n");
  check("a send appends one line", lines.length === 1, `${lines.length}`);
  check("carrying all five facts", /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} \| נשלח \| מאת: עמר \(o@test\) \| אל: dana@test \| נושא: דוח שבועי$/.test(lines[0]), lines[0]);

  await call("failed");
  lines = readFileSync(LOG, "utf8").trim().split("\n");
  check("a FAILED send is logged too — half a mechanism is not under test", lines[1]?.includes("| נכשל |"), lines[1] ?? "");

  for (let i = 0; i < 3; i++) await call("sent");
  lines = readFileSync(LOG, "utf8").trim().split("\n");
  check("a burst of N sends appends exactly N lines", lines.length === 5, `${lines.length} of 5`);

  const legacy = await run("python3", [SCRIPT, "--title", "ישן", "--body", "גוף", "--to", "x@test"],
    { env: { ...env, EMAILER_FORCE: "sent" } }).catch((e) => e as { stdout?: string });
  lines = readFileSync(LOG, "utf8").trim().split("\n");
  check("the sender flag is OPTIONAL to the script — the old three-flag call still works",
    (legacy.stdout ?? "").trim().split("\n").pop() === "1" && lines[5]?.includes("מאת: ?"), lines[5] ?? "");

  // an unwritable log must not break the send
  const jail = await run("python3", [SCRIPT, "--title", "t", "--body", "גוף", "--to", "x@test", "--from", "מ"],
    { env: { ...process.env, EMAILER_LOG: "/proc/no-such-dir/mail.log", EMAILER_FORCE: "sent" } }).catch((e) => e as { stdout?: string; stderr?: string });
  check("an unwritable log still yields the verdict", (jail.stdout ?? "").trim().split("\n").pop() === "1");
  check("with a warning, not a crash", (jail.stderr ?? "").includes("could not write mail log"), (jail.stderr ?? "").slice(0, 60));

  rmSync(LOG, { force: true });
  check("the scratch log was cleaned up", !existsSync(LOG));
  check("and the default mail.log was never touched by the suite", !existsSync("docker/mail.log"),
    "sends during verification must not pollute the real log");
}

async function main() {
  // Route EVERY send in this suite — including the ones inside sendReport —
  // to the scratch log. Without this, the contract and mapping sections write
  // the developer's real default mail.log as a side effect of verifying.
  process.env.EMAILER_LOG = "docker/mail-verify.log";
  await contract();
  await sendLog();
  await mapping();
  await crashes();
  subjects();
  // mapping() and crashes() wrote the scratch again after sendLog cleaned it —
  // the LAST cleanup has to come after the last section that sends
  rmSync("docker/mail-verify.log", { force: true });
  check("no scratch log outlives the suite", !existsSync("docker/mail-verify.log"));
  console.log(failures === 0 ? `\nall ${checks} checks passed` : `\nFAILED — ${checks} ran, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

main();
