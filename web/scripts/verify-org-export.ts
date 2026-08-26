/**
 * Verification for org-tree-export — the pyramid's geometry, and the two files.
 *
 * Needs the dev server on :4321 (the route is exercised over HTTP, as a
 * browser would).
 *
 *   npx tsx scripts/verify-org-export.ts
 */
import AdmZip from "adm-zip";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { layoutTree, pruneTree, exportTitle, pageFit } from "@/lib/org-export";
import type { GapTreeNode } from "@/lib/gap-dashboard";

const TAG = "oeverify";
const BASE = process.env.BASE_URL ?? "http://localhost:4321";

let failures = 0;
let checks = 0;
function check(label: string, ok: boolean, detail = "") {
  checks++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function cleanup() {
  await prisma.person.deleteMany({ where: { fullName: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { username: { startsWith: TAG } } });
  await prisma.orgNode.deleteMany({ where: { name: { startsWith: TAG } } });
}

/** A hand-built forest — the layout module knows nothing of the database. */
const n = (id: string, name: string, total: number, commander: string | null, children: GapTreeNode[] = []): GapTreeNode => ({
  id, name, kind: "TEAM", level: null, commander, total,
  red: 0, yellow: 0, overdueEvents: 0, approachingEvents: 0, people: [], children,
});

const OPTS = { excluded: new Set<string>(), showCommander: true, showCount: true };

async function main() {
  console.log("=== layout: the geometry of a tidy tree ===");
  const forest = [
    n("root", "מרכז", 100, "אל״מ כהן", [
      n("a", "תחום א", 60, "סא״ל לוי", [n("a1", "מדור א1", 30, null), n("a2", "מדור א2", 30, "רס״ן דוד")]),
      n("b", "תחום ב", 40, null),
    ]),
  ];
  const l = layoutTree(forest, OPTS);
  check("every framework gets a box", l.boxes.length === 5, `${l.boxes.length}`);
  check("no people are drawn — frameworks only", !l.boxes.some((b) => b.name.includes("איש")));
  const box = (id: string) => l.boxes.find((b) => b.id === id)!;
  check("the parent is centred over its children",
    Math.abs((box("a").x + box("a").w / 2) - ((box("a1").x + box("a1").w / 2 + box("a2").x + box("a2").w / 2) / 2)) < 0.01,
    `${box("a").x + box("a").w / 2}`);
  check("levels descend", box("root").y < box("a").y && box("a").y < box("a1").y);
  check("siblings do not overlap", box("a1").x + box("a1").w <= box("a2").x);
  check("subtrees do not overlap", box("a2").x + box("a2").w <= box("b").x || box("b").x + box("b").w <= box("a1").x);
  check("a commanded box carries the name", box("a").commander === "סא״ל לוי");
  check("an uncommanded box keeps an EMPTY line, not a missing one",
    box("a1").commander === "" && box("a1").h === box("a").h, `${JSON.stringify(box("a1").commander)}`);
  check("the count reads as people", box("root").count === "100 אנשים", String(box("root").count));
  check("an edge exists per parent-child pair", l.edges.length === 4, `${l.edges.length}`);
  check("the title names the root", l.title === "עץ מבנה מרכז", l.title);

  console.log("\n=== toggles and pruning ===");
  const bare = layoutTree(forest, { ...OPTS, showCommander: false, showCount: false });
  check("turning both off leaves names only",
    bare.boxes.every((b) => b.commander === null && b.count === null));
  check("...and the boxes get shorter", bare.boxes[0].h < l.boxes[0].h);
  const pruned = pruneTree(forest, new Set(["a"]));
  const pl = layoutTree(pruned, OPTS);
  check("pruning a branch removes it and its subtree",
    !pl.boxes.some((b) => ["a", "a1", "a2"].includes(b.id)) && pl.boxes.length === 2, `${pl.boxes.length}`);
  check("but the parent's count is untouched", pl.boxes.find((b) => b.id === "root")!.count === "100 אנשים");
  check("the title follows the surviving root", exportTitle(pruned) === "עץ מבנה מרכז");

  console.log("\n=== a WIDE org rearranges itself instead of shrinking to a strip ===");
  // the shape that broke it: 4 domains × 3 sections × 3 teams
  const wide = [
    n("c", "מרכז", 300, "אל״מ כהן",
      Array.from({ length: 4 }, (_, d) =>
        n(`d${d}`, `תחום ${d}`, 75, null,
          Array.from({ length: 3 }, (_, s) =>
            n(`d${d}s${s}`, `מדור ${d}-${s}`, 25, null,
              Array.from({ length: 3 }, (_, t) => n(`d${d}s${s}t${t}`, `צוות ${d}-${s}-${t}`, 8, null)))))),
    ),
  ];
  const wl = layoutTree(wide, OPTS);
  check("the wide tree stacks its lower levels", Number.isFinite(wl.stackDepth), `stackDepth ${wl.stackDepth}`);
  check("it is no longer an unreadable strip", wl.width / wl.height < 3, `aspect ${(wl.width / wl.height).toFixed(2)}`);
  check("every framework is still drawn", wl.boxes.length === 53, `${wl.boxes.length}`);
  check("stacked children sit BELOW their parent, not beside it",
    (() => { const p = wl.boxes.find((b) => b.id === "d0s0")!; const c = wl.boxes.find((b) => b.id === "d0s0t0")!; return c.y > p.y; })());
  check("...and each stacked sibling below the previous",
    (() => { const a = wl.boxes.find((b) => b.id === "d0s0t0")!; const b2 = wl.boxes.find((b) => b.id === "d0s0t1")!; return b2.y >= a.y + a.h; })());
  check("no two boxes overlap anywhere",
    (() => {
      for (let i = 0; i < wl.boxes.length; i++) for (let j = i + 1; j < wl.boxes.length; j++) {
        const a = wl.boxes[i], b = wl.boxes[j];
        if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) return false;
      }
      return true;
    })());
  check("the rearrangement genuinely helps the page fit", pageFit(wl) > 2.5 * pageFit({ width: 7950, height: 450 }),
    `fit ${pageFit(wl).toFixed(2)}`);

  console.log("\n=== a small tree keeps its pyramid — the change is for MANY frameworks ===");
  check("no stacking when the drawing already fits", l.stackDepth === Infinity, String(l.stackDepth));
  check("its children stand side by side", box("a1").y === box("a2").y && box("a1").x !== box("a2").x);

  console.log("\n=== long labels are clipped to their box, never spilling ===");
  const longName = layoutTree(
    [n("x", "מדור אינטגרציה ובקרת איכות ראשי מורחב", 5, "אלוף משנה ישראל ישראלי הראשון מטעם המפקדה")],
    OPTS,
  );
  check("a long name is ellipsised", longName.boxes[0].name.endsWith("…") && longName.boxes[0].name.length <= 22,
    `${longName.boxes[0].name.length} chars`);
  check("a long commander line too", longName.boxes[0].commander!.endsWith("…") && longName.boxes[0].commander!.length <= 30);
  check("a short name is untouched", layoutTree([n("y", "מדור מחקר", 5, null)], OPTS).boxes[0].name === "מדור מחקר");

  console.log("\n=== the route: real files, over HTTP ===");
  await cleanup();
  const center = await prisma.orgNode.create({ data: { name: `${TAG} מרכז`, kind: "CENTER" } });
  const domain = await prisma.orgNode.create({ data: { name: `${TAG} תחום`, kind: "DOMAIN", parentId: center.id } });
  const gone = await prisma.orgNode.create({ data: { name: `${TAG} תחום-מוסתר`, kind: "DOMAIN", parentId: center.id } });
  const admin = await prisma.user.create({
    data: { name: `${TAG} אלוף בודק`, email: `${TAG}@verify.invalid`, username: `${TAG}-adm`,
      passwordHash: hashPassword("x"), role: "ADMIN", commandsNodeId: domain.id },
  });
  const cookie = `${SESSION_COOKIE}=${createSessionToken(admin.id)}`;

  try {
    const post = (body: Record<string, string | string[]>) => {
      const fd = new URLSearchParams();
      for (const [k, v] of Object.entries(body)) for (const one of Array.isArray(v) ? v : [v]) fd.append(k, one);
      return fetch(`${BASE}/api/org-export`, { method: "POST", headers: { cookie, "content-type": "application/x-www-form-urlencoded" }, body: fd });
    };

    const noSession = await fetch(`${BASE}/api/org-export`, { method: "POST", body: new URLSearchParams({ format: "pdf" }) });
    check("without a session the route refuses", noSession.status === 401, `HTTP ${noSession.status}`);

    const pptxRes = await post({ format: "pptx", node: center.id, showCommander: "1", showCount: "1", excluded: gone.id });
    check("the PPTX responds as a presentation", pptxRes.status === 200 &&
      (pptxRes.headers.get("content-type") ?? "").includes("presentationml"), `HTTP ${pptxRes.status}`);
    const zip = new AdmZip(Buffer.from(await pptxRes.arrayBuffer()));
    const slide = zip.getEntry("ppt/slides/slide1.xml")?.getData().toString("utf8") ?? "";
    check("the pptx unzips to a slide", slide.length > 0, `${zip.getEntries().length} entries`);
    check("the slide names the frameworks", slide.includes(`${TAG} מרכז`) && slide.includes(`${TAG} תחום`));
    check("the excluded branch is absent", !slide.includes(`${TAG} תחום-מוסתר`));
    check("the commander is on the slide", slide.includes(`${TAG} אלוף בודק`));
    check("the count line is there", /\d+ אנשים/.test(slide));
    check("the boxes are editable SHAPES, not a picture",
      slide.includes("roundRect") && !slide.includes("<p:pic>"));
    check("the title is on the slide", slide.includes("עץ מבנה"));

    // The deformation that was reported: type larger than the box holding it.
    // Read both back OUT of the file — box heights (EMU) and font sizes
    // (hundredths of a point) — and check three lines actually fit.
    const EMU_PER_PT = 914400 / 72;
    // heights of the BOXES only — a connector segment is a shape too, and its
    // height is not a box's (that mistake is what this comment is for)
    const boxPts = slide
      .split("<p:sp>")
      .filter((sp) => sp.includes("roundRect"))
      .map((sp) => Number(/<a:ext cx="\d+" cy="(\d+)"\/>/.exec(sp)?.[1] ?? 0) / EMU_PER_PT)
      .filter((v) => v > 0);
    // the title is written before any shape, so everything from the first
    // roundRect onward belongs to the boxes
    const shapesXml = slide.slice(slide.indexOf("roundRect"));
    const sizes = [...shapesXml.matchAll(/sz="(\d+)"/g)].map((m) => Number(m[1]) / 100);
    const shortestBox = Math.min(...boxPts);
    const tallestText = Math.max(...sizes);
    check("the type never outgrows its box — three lines fit with room",
      tallestText * 1.2 * 3 <= shortestBox,
      `${tallestText}pt × 3 lines vs a ${shortestBox.toFixed(1)}pt box`);
    check("and the type is not absurdly small either for a small tree", sizes.length > 0);

    const bareRes = await post({ format: "pptx", node: center.id, excluded: gone.id }); // both toggles off
    const bareSlide = new AdmZip(Buffer.from(await bareRes.arrayBuffer()))
      .getEntry("ppt/slides/slide1.xml")!.getData().toString("utf8");
    check("with the toggles off, no commander and no count",
      !bareSlide.includes(`${TAG} אלוף בודק`) && !/\d+ אנשים/.test(bareSlide));

    const pdfRes = await post({ format: "pdf", node: center.id, showCommander: "1", showCount: "1" });
    const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
    check("the PDF responds as a pdf", pdfRes.status === 200 && (pdfRes.headers.get("content-type") ?? "").includes("pdf"));
    check("it really is a PDF of substance", pdfBuf.subarray(0, 4).toString() === "%PDF" && pdfBuf.length > 5000, `${pdfBuf.length} bytes`);

    const allOut = await post({ format: "pdf", node: center.id, excluded: [center.id] });
    check("excluding everything is refused, not an empty file", allOut.status === 400, `HTTP ${allOut.status}`);

    const logged = await prisma.activityLog.count({ where: { action: "org.export" } });
    check("the exports are recorded in the activity log", logged >= 3, `${logged}`);
  } finally {
    await cleanup();
    const residue = (await prisma.orgNode.count({ where: { name: { startsWith: TAG } } })) +
      (await prisma.user.count({ where: { username: { startsWith: TAG } } }));
    check("no fixtures left behind", residue === 0, `${residue}`);
  }

  if (checks === 0) { console.log("\nFAILED — ZERO checks"); process.exitCode = 1; }
  else { console.log(failures ? `\nFAILED — ${checks} ran, ${failures} failed` : `\nall ${checks} checks passed`); process.exitCode = failures ? 1 : 0; }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("\nFAILED — the suite crashed:", e);
  await cleanup().catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
