/**
 * Verification for email-reports (tasks 5.1, 5.2, 5.2b, 5.6).
 *
 * Covers the transport, not the pages: what the script is handed, how every
 * outcome maps, and the byte-vs-character limit that a plausible-looking
 * character check would get backwards.
 *
 *   npx tsx scripts/verify-emailer.ts
 */
import { execFile } from "child_process";
import { readFileSync } from "fs";
import { promisify } from "util";
import { sendReport } from "../src/lib/emailer";

const run = promisify(execFile);

let failures = 0;
let checks = 0;
function check(label: string, ok: boolean, detail = "") {
  checks++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function script() {
  console.log("\n=== 5.1 the script honours its contract ===");
  // forced sent → exit 201, and it echoes back what it received
  let stdout = "";
  let code: number | null = null;
  try {
    const r = await run("python3", ["docker/emailer.py", "--title", "כותרת", "--body", "גוף הדוח", "--to", "u@example.invalid"], {
      env: { ...process.env, EMAILER_FORCE: "sent" },
    });
    stdout = r.stdout;
    code = 0;
  } catch (e) {
    const err = e as { code?: number; stdout?: string };
    stdout = err.stdout ?? "";
    code = Number(err.code);
  }
  check("EMAILER_FORCE=sent exits 201", code === 201, String(code));
  check("it echoes the recipient", stdout.includes("to=u@example.invalid"), stdout.split("\n")[0] ?? "");
  check("it echoes the title", stdout.includes("title=כותרת"));
  // computed, not hardcoded — an expectation I got wrong once already
  const body = "גוף הדוח";
  check(`it reports the body size in BYTES (${Buffer.byteLength(body)})`,
    stdout.includes(`body_bytes=${Buffer.byteLength(body)}`), stdout.match(/body_bytes=\d+/)?.[0] ?? "");
  check(`and separately in characters (${body.length}) — they differ for Hebrew`,
    stdout.includes(`body_chars=${body.length}`), stdout.match(/body_chars=\d+/)?.[0] ?? "");

  let failCode: number | null = null;
  try {
    await run("python3", ["docker/emailer.py", "--title", "t", "--body", "b", "--to", "a@b.c"], {
      env: { ...process.env, EMAILER_FORCE: "failed" },
    });
    failCode = 0;
  } catch (e) {
    failCode = Number((e as { code?: number }).code);
  }
  check("EMAILER_FORCE=failed does not exit 201", failCode !== 201, String(failCode));
  check("the failure code is small, not a masked HTTP status", failCode !== null && failCode < 256 && failCode !== 244,
    String(failCode));

  const src = readFileSync("docker/emailer.py", "utf8");
  check("the file says it is a stand-in the target environment replaces", src.includes("STAND-IN") && src.includes("replaces it"));
  check("it warns about the 8-bit exit-code trap", src.includes("457"));
}

async function mapping() {
  console.log("\n=== 5.2 every outcome maps to a result, and nothing throws ===");
  process.env.EMAILER_FORCE = "sent";
  const sent = await sendReport({ title: "t", body: "גוף", to: "a@b.c" });
  check("forced success → ok", sent.ok === true, JSON.stringify(sent));

  process.env.EMAILER_FORCE = "failed";
  const failed = await sendReport({ title: "t", body: "גוף", to: "a@b.c" });
  check("forced failure → not ok, with a reason", failed.ok === false && !!(failed as { reason: string }).reason,
    JSON.stringify(failed).slice(0, 80));

  process.env.EMAILER_FORCE = "sent";
  const noAddress = await sendReport({ title: "t", body: "גוף", to: "" });
  check("no address → not ok", noAddress.ok === false);
  const emptyBody = await sendReport({ title: "t", body: "   ", to: "a@b.c" });
  check("empty body → not ok", emptyBody.ok === false);

  // Missing script. chdir does NOT work here — emailer.ts resolves the path once
  // at import — so the file itself is moved aside, which is what actually
  // happens if a deployment forgets to copy docker/.
  const { renameSync } = await import("fs");
  const from = "docker/emailer.py";
  const to = "docker/emailer.py.moved";
  renameSync(from, to);
  try {
    const missing = await sendReport({ title: "t", body: "גוף", to: "a@b.c" });
    check("missing script → not ok, and the reason names it", missing.ok === false &&
      (missing as { reason: string }).reason.includes("emailer.py"), (missing as { reason: string }).reason ?? "ok:true");
  } finally {
    renameSync(to, from);
  }
}

async function byteLimit() {
  console.log("\n=== 5.2b the limit is bytes, not characters ===");
  process.env.EMAILER_FORCE = "sent";
  // 70,000 Hebrew characters = 140,000 bytes: over the 131,071 limit. A
  // `.length` check would see 70,000 and let it through, and the spawn would
  // die with E2BIG.
  const over = "א".repeat(70_000);
  const under = "א".repeat(60_000); // 120,000 bytes
  check("70,000 Hebrew chars (140,000 bytes) is refused", (await sendReport({ title: "t", body: over, to: "a@b.c" })).ok === false);
  check("60,000 Hebrew chars (120,000 bytes) is accepted", (await sendReport({ title: "t", body: under, to: "a@b.c" })).ok === true);
  check("a character-based check would have got this backwards",
    over.length < 131_071 && Buffer.byteLength(over) > 131_071,
    `${over.length} chars but ${Buffer.byteLength(over).toLocaleString()} bytes`);
}

function image() {
  console.log("\n=== 5.6 the interpreter is in the runtime image ===");
  const df = readFileSync("Dockerfile", "utf8");
  const runtime = df.slice(df.lastIndexOf("FROM "));
  check("the runtime stage installs python3", /^\s*python3\s*\\?$/m.test(runtime) || runtime.includes(" python3 "),
    "grep of the final stage");
  console.log("  (note: docker is not reachable from here — the image build itself was NOT exercised)");
}

async function main() {
  await script();
  await mapping();
  await byteLimit();
  image();
  console.log(failures === 0 ? `\nall ${checks} checks passed` : `\nFAILED — ${checks} ran, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

main();
