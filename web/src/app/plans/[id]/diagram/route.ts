import { NextResponse, type NextRequest } from "next/server";
import { getSessionUserOrNull } from "@/lib/session";
import { getPlan } from "@/lib/plans";
import { buildPlanDiagramSvg } from "@/lib/plan-diagram";

/** Download the plan's career-path diagram: ?format=pdf (presentations) | ?format=svg. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserOrNull();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const plan = await getPlan(id);
  if (!plan) return new NextResponse("not found", { status: 404 });

  const svg = buildPlanDiagramSvg(plan);
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `מסלול-${plan.name.replace(/[/\\:*?"<>|]/g, "_").slice(0, 60)}-${stamp}`;
  const format = req.nextUrl.searchParams.get("format") === "svg" ? "svg" : "pdf";

  if (format === "svg") {
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${base}.svg`)}`,
      },
    });
  }

  // presentation-clean A4 via the baked-in Chromium (same pipeline as report PDFs)
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<style>
  body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  svg { width: 100%; height: auto; max-height: 96vh; }
</style></head><body>${svg}</body></html>`;

  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
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
