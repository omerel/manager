/**
 * Verification for israeli-date-format (tasks 6.1, 6.2, 6.6).
 *
 * The parser is the whole change, so it is asserted as a table rather than
 * eyeballed — including the case that motivated the work: the platform's own
 * `new Date` reads 03/08/2026 as March, and this must disagree with it.
 *
 *   npx tsx scripts/verify-israeli-dates.ts
 */
import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";
import { parseIsraeliDate, formatIsraeliDate } from "../src/lib/dates";

let failures = 0;
let checks = 0;
function check(label: string, ok: boolean, detail = "") {
  checks++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

function parserTable() {
  console.log("\n=== 6.1 the parser reads Israeli dates, and refuses the rest ===");
  const accepted: [string, string][] = [
    ["03/08/2026", "2026-08-03"],
    ["3/8/2026", "2026-08-03"],
    ["3.8.2026", "2026-08-03"],
    ["03-08-2026", "2026-08-03"],
    ["2026-08-03", "2026-08-03"], // ISO, unambiguous
    ["13/05/2026", "2026-05-13"], // day > 12: only one possible reading anyway
    ["01/01/2000", "2000-01-01"],
    ["29/02/2024", "2024-02-29"], // real leap day
  ];
  for (const [raw, want] of accepted) check(`"${raw}" → ${want}`, iso(parseIsraeliDate(raw)) === want, iso(parseIsraeliDate(raw)) ?? "REFUSED");

  const refused = [
    "31/02/2026", // rolls into March if you let Date do it
    "29/02/2026", // not a leap year
    "13/13/2026",
    "00/08/2026",
    "03/00/2026",
    "Aug 3, 2026",
    "3/8/26", // two-digit year is ambiguous about the century
    "2026/08/03",
    "",
    "   ",
    "abc",
  ];
  for (const raw of refused) check(`"${raw}" refused`, parseIsraeliDate(raw) === null, iso(parseIsraeliDate(raw)) ?? "");
}

function noAmericanReading() {
  console.log("\n=== 6.2 the American reading is genuinely gone ===");
  // The exact pair that motivated the change: both readings are numerically
  // possible, and the platform picks the wrong one.
  const raw = "03/08/2026";
  const ours = iso(parseIsraeliDate(raw));
  const platform = new Date(raw).toISOString().slice(0, 10);
  check(`our reader and new Date() disagree on "${raw}"`, ours !== platform, `${ours} vs ${platform}`);
  check("ours is the Israeli reading", ours === "2026-08-03", ours ?? "");
  check("the platform's is the American one, shifted by timezone", platform === "2026-03-07", platform);

  // Every ambiguous day (1..12) must read day-first, all 12 of them.
  const wrong = Array.from({ length: 12 }, (_, i) => i + 1).filter((d) => {
    const got = iso(parseIsraeliDate(`${String(d).padStart(2, "0")}/08/2026`));
    return got !== `2026-08-${String(d).padStart(2, "0")}`;
  });
  check("all 12 ambiguous day/month pairs read day-first", wrong.length === 0, `wrong for days: ${wrong}`);
}

function roundTrip() {
  console.log("\n=== 6.1 round-trip property ===");
  let bad = 0;
  const start = Date.UTC(1990, 0, 1);
  for (let i = 0; i < 15000; i++) {
    const d = new Date(start + i * 86400000);
    const back = parseIsraeliDate(formatIsraeliDate(d));
    if (!back || back.getTime() !== d.getTime()) bad++;
  }
  check("parse(format(d)) === d over 15,000 consecutive days", bad === 0, `${bad} mismatches`);
}

function sourceGuards() {
  console.log("\n=== 6.6 the old doors are closed in the source ===");
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const f = path.join(dir, e);
      if (e === "generated" || e === "node_modules") continue;
      if (statSync(f).isDirectory()) walk(f);
      else if (/\.tsx?$/.test(f)) files.push(f);
    }
  };
  walk("src");

  const nativeInputs = files.filter((f) => f !== "src/components/DateField.tsx" && readFileSync(f, "utf8").includes('type="date"'));
  check("no native <input type=date> outside DateField", nativeInputs.length === 0, nativeInputs.join(", "));

  // new Date(<something that is not a Date/number/now>) on parse paths
  const parsers = files.filter((f) => {
    if (f === "src/lib/dates.ts") return false; // its doc comment quotes the bug
    const src = readFileSync(f, "utf8");
    return /new Date\((?!\)|Date\.|base\)|start|d\)|[0-9])/.test(src);
  });
  check("no new Date(<string>) left on a parse path", parsers.length === 0, parsers.join(", "));
}

parserTable();
noAmericanReading();
roundTrip();
sourceGuards();

console.log(failures === 0 ? `\nall ${checks} checks passed` : `\nFAILED — ${checks} ran, ${failures} failed`);
process.exit(failures ? 1 : 0);
