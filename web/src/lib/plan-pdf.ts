import { NextResponse } from "next/server";
import { getPlan } from "@/lib/plans";
import { buildPlanDiagramSvg, STATUS_STYLE, VECTOR_LEGEND } from "@/lib/plan-diagram";
import { buildPersonTimeline, buildVectorStatus, type PersonFull } from "@/lib/person-view";

/**
 * A person's career plan as a PDF, in THEIR colours.
 *
 * Only the rendering lives here. Authorization deliberately does NOT: each
 * route decides for itself who may ask — a commander through their visibility,
 * a guest through the signed cookie naming them — and then calls this with a
 * person it has already decided about. Folding the two together would make one
 * function answer both "may you?" and "what does it look like?", and the next
 * caller would get the answer to the wrong one.
 */
export async function renderPlanPdf(person: PersonFull): Promise<NextResponse> {
  if (!person.assignedPlanId) return new NextResponse("לאיש זה אין מסלול קריירה משויך.", { status: 400 });
  const plan = await getPlan(person.assignedPlanId);
  if (!plan) return new NextResponse("not found", { status: 404 });

  const today = new Date();
  const svg = buildPlanDiagramSvg(plan, buildVectorStatus(buildPersonTimeline(person), person.placementDate, today));

  // the key to the colours, from the same list the card's legend reads
  const legend =
    VECTOR_LEGEND.map((l) => {
      const c = STATUS_STYLE[l.status];
      return `<span class="chip" style="background:${c.bg};border-color:${c.border};color:${c.accent}">${l.label}</span>`;
    }).join("") + `<span class="chip star">★ אירוע אישי</span>`;

  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<style>
  body { margin: 0; font-family: Rubik, 'Noto Sans Hebrew', sans-serif;
         display: flex; flex-direction: column; align-items: center; }
  h1 { font-size: 20px; margin: 6mm 0 1mm; color: #064e3b; }
  p.sub { margin: 0 0 2mm; font-size: 12px; color: #78716c; }
  .legend { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center;
            align-items: center; margin: 0 0 4mm; font-size: 11px; }
  .legend .label { color: #78716c; }
  .chip { border: 1px solid; border-radius: 999px; padding: 2px 10px; font-weight: 600; }
  .chip.star { background: #fffbeb; border-color: #fcd34d; color: #b45309; }
  svg { width: 100%; height: auto; max-height: 84vh; }
</style></head><body>
  <h1>${esc(person.fullName)}</h1>
  <p class="sub">תכנית קריירה · הופק ${today.toLocaleDateString("he-IL")}</p>
  <div class="legend"><span class="label">מקרא — מצבו מול כל אירוע:</span>${legend}</div>
  ${svg}
</body></html>`;

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
    const stamp = today.toISOString().slice(0, 10);
    const base = `תכנית-${person.fullName.replace(/[/\\:*?"<>|]/g, "_").slice(0, 60)}-${stamp}`;
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
