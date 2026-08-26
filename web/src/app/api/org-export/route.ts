import { NextResponse, type NextRequest } from "next/server";
import { getSessionUserOrNull } from "@/lib/session";
import { computeVisibility } from "@/lib/access";
import { logActivity } from "@/lib/activity-log";
import { buildGapTree, findNode } from "@/lib/gap-dashboard";
import { layoutTree, pruneTree, type ExportLayout, type ExportOptions } from "@/lib/org-export";

/**
 * Export the dashboard's org tree as an editable PowerPoint or a PDF.
 *
 * The tree is REBUILT here from the requester's own visibility and only then
 * narrowed and pruned by what they sent: the request carries choices, never
 * data. A tampered body can therefore never draw a framework its sender
 * cannot already see on their dashboard.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUserOrNull();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const form = await req.formData();
  const str = (k: string) => String(form.get(k) ?? "").trim();
  const format = str("format") === "pptx" ? "pptx" : "pdf";
  const opts: ExportOptions = {
    excluded: new Set(form.getAll("excluded").map(String)),
    showCommander: str("showCommander") === "1",
    showCount: str("showCount") === "1",
  };

  const visibility = await computeVisibility(user);
  const allRoots = await buildGapTree(visibility, new Date());
  // the same re-rooting the dashboard does — a node outside their sight finds
  // nothing and falls back to their full scope
  const chosen = str("node") ? findNode(allRoots, str("node")) : null;
  const roots = pruneTree(chosen ? [chosen] : allRoots, opts.excluded);
  if (roots.length === 0) return new NextResponse("אין מסגרות לייצוא — כל הענפים הוסרו.", { status: 400 });

  const layout = layoutTree(roots, opts);
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `${layout.title.replace(/[/\\:*?"<>|]/g, "_").slice(0, 60)}-${stamp}`;

  await logActivity({
    action: "org.export",
    description: `ייצא עץ מבנה (${format === "pptx" ? "PowerPoint" : "PDF"}): ${layout.title}, ${layout.boxes.length} מסגרות`,
    subjectType: "org",
  });

  if (format === "pptx") {
    const body = await buildPptx(layout);
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${base}.pptx`)}`,
      },
    });
  }

  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(pdfHtml(layout), { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      margin: { top: "8mm", bottom: "8mm", left: "8mm", right: "8mm" },
      printBackground: true,
    });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${base}.pdf`)}`,
      },
    });
  } finally {
    await browser.close();
  }
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The same geometry as SVG, inside a print page Chromium lays out (Hebrew shaping included). */
function pdfHtml(layout: ExportLayout): string {
  const parts: string[] = [];
  for (const e of layout.edges) {
    // tee: down, across, down into a child standing below the parent
    // elbow: down the spine, then across into a child indented beside it
    const d =
      e.style === "elbow"
        ? `M ${e.fromX} ${e.fromY} V ${e.toY} H ${e.toX}`
        : `M ${e.fromX} ${e.fromY} V ${(e.fromY + e.toY) / 2} H ${e.toX} V ${e.toY}`;
    parts.push(`<path d="${d}" fill="none" stroke="#a8a29e" stroke-width="1.5"/>`);
  }
  for (const b of layout.boxes) {
    parts.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="8"
      fill="#f5f5f4" stroke="#78716c" stroke-width="1.5"/>`);
    let ty = b.y + 22;
    parts.push(`<text x="${b.x + b.w / 2}" y="${ty}" text-anchor="middle" font-size="14" font-weight="700" fill="#1c1917">${esc(b.name)}</text>`);
    if (b.commander !== null) {
      ty += 16;
      parts.push(`<text x="${b.x + b.w / 2}" y="${ty}" text-anchor="middle" font-size="11" fill="#57534e">${esc(b.commander)}</text>`);
    }
    if (b.count !== null) {
      ty += 16;
      parts.push(`<text x="${b.x + b.w / 2}" y="${ty}" text-anchor="middle" font-size="11" fill="#57534e">${esc(b.count)}</text>`);
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}"
    width="${layout.width}" height="${layout.height}" font-family="Arial, sans-serif">${parts.join("")}</svg>`;

  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><style>
    body { margin: 0; font-family: Arial, sans-serif; display: flex; flex-direction: column; align-items: center; }
    h1 { font-size: 20px; margin: 6mm 0 4mm; color: #1c1917; }
    svg { width: 100%; height: auto; max-height: 88vh; }
  </style></head><body><h1>${esc(layout.title)}</h1>${svg}</body></html>`;
}

/** Real shapes and connectors — the slide is meant to be edited, not admired. */
async function buildPptx(layout: ExportLayout): Promise<Buffer> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  const SLIDE_W = 10;
  const SLIDE_H = 5.625;
  const slide = pptx.addSlide();

  slide.addText(layout.title, {
    x: 0, y: 0.15, w: SLIDE_W, h: 0.5,
    align: "center", fontSize: 20, bold: true, color: "1C1917", rtlMode: true,
  });

  // one uniform scale for the whole drawing, so nothing distorts
  const top = 0.8;
  const scale = Math.min((SLIDE_W - 0.6) / layout.width, (SLIDE_H - top - 0.3) / layout.height);
  const offX = (SLIDE_W - layout.width * scale) / 2;
  const px = (v: number) => offX + v * scale;
  const py = (v: number) => top + v * scale;

  for (const e of layout.edges) {
    const seg = (x1: number, y1: number, x2: number, y2: number) =>
      slide.addShape(pptx.ShapeType.line, {
        x: px(Math.min(x1, x2)), y: py(Math.min(y1, y2)),
        w: Math.abs(x2 - x1) * scale, h: Math.abs(y2 - y1) * scale,
        line: { color: "A8A29E", width: 1 },
        flipH: x2 < x1, flipV: y2 < y1,
      });
    if (e.style === "elbow") {
      seg(e.fromX, e.fromY, e.fromX, e.toY);
      seg(e.fromX, e.toY, e.toX, e.toY);
    } else {
      const midY = (e.fromY + e.toY) / 2;
      seg(e.fromX, e.fromY, e.fromX, midY);
      seg(e.fromX, midY, e.toX, midY);
      seg(e.toX, midY, e.toX, e.toY);
    }
  }

  // Type scales WITH the drawing, exactly as it does in the SVG: a point is
  // 1/72 inch and `scale` is inches per layout unit, so the same 14/11 unit
  // sizes the PDF uses become these. A fixed size (or a floor) is what made a
  // dense slide deform — text larger than the box it sits in. There is no
  // floor here on purpose: legibility is the LAYOUT's job, and stacking is how
  // it does it. `fit: shrink` below is only a last-resort guard.
  const pt = (units: number) => Math.round(units * scale * 72 * 2) / 2;
  const nameSize = pt(14);
  const lineSize = pt(11);

  for (const b of layout.boxes) {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: px(b.x), y: py(b.y), w: b.w * scale, h: b.h * scale,
      fill: { color: "F5F5F4" }, line: { color: "78716C", width: 1 }, rectRadius: 0.05,
    });
    const lines = [{ text: b.name, options: { bold: true, fontSize: nameSize } }];
    if (b.commander !== null) lines.push({ text: `\n${b.commander}`, options: { bold: false, fontSize: lineSize } });
    if (b.count !== null) lines.push({ text: `\n${b.count}`, options: { bold: false, fontSize: lineSize } });
    slide.addText(lines, {
      x: px(b.x), y: py(b.y), w: b.w * scale, h: b.h * scale,
      align: "center", valign: "middle", color: "1C1917", rtlMode: true, margin: 1,
      // last line of defence: PowerPoint itself shrinks anything still too long
      fit: "shrink", wrap: true,
    });
  }

  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}
