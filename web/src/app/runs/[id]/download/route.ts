import { NextResponse, type NextRequest } from "next/server";
import { marked } from "marked";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

/** Wrap rendered markdown in a printable RTL page. */
function htmlShell(title: string, bodyHtml: string, dateStr: string): string {
  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<style>
  body { font-family: "Noto Sans Hebrew", "DejaVu Sans", Arial, sans-serif; margin: 32px; color: #0f172a; line-height: 1.55; }
  h1, h2, h3 { margin: 1.1em 0 0.4em; }
  table { border-collapse: collapse; width: 100%; margin: 0.6em 0; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 10px; text-align: right; font-size: 13px; }
  th { background: #f1f5f9; }
  blockquote { border-inline-start: 3px solid #cbd5e1; margin: 0.6em 0; padding-inline-start: 12px; color: #475569; }
  code { background: #f1f5f9; padding: 1px 4px; border-radius: 4px; }
  .meta { color: #64748b; font-size: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 16px; }
</style>
</head>
<body>
<div class="meta">${title} · הופק ${dateStr} · מערכת ניהול קריירה</div>
${bodyHtml}
</body>
</html>`;
}

/** Download a run's output as md or pdf. Owner-only. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const format = req.nextUrl.searchParams.get("format") === "pdf" ? "pdf" : "md";

  const me = await getSessionUser();
  const run = await prisma.agentRun.findFirst({
    where: { id, userId: me.id, status: "SUCCEEDED" },
    include: { rule: { select: { name: true } } },
  });
  if (!run?.output) return new NextResponse("not found", { status: 404 });

  const base = (run.rule?.name ?? "תשובה").replace(/[/\\:*?"<>|]/g, "_").slice(0, 60);
  const dateStr = run.createdAt.toISOString().slice(0, 10);
  const filename = `${base}-${dateStr}.${format}`;
  const disposition = `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`;

  if (format === "md") {
    return new NextResponse(run.output, {
      headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": disposition },
    });
  }

  // PDF: markdown → HTML → print via headless chromium (real RTL rendering)
  const bodyHtml = await marked.parse(run.output, { gfm: true });
  const html = htmlShell(base, bodyHtml, dateStr);
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      margin: { top: "15mm", bottom: "15mm", left: "12mm", right: "12mm" },
      printBackground: true,
    });
    return new NextResponse(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": disposition },
    });
  } finally {
    await browser.close();
  }
}
