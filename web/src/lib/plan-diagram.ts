import type { PlanWithEvents } from "@/lib/plans";
import { unrollRecurring } from "@/lib/plans";

/**
 * Pure SVG-string builder for the career-path diagram: a large upward arrow
 * from recruitment (base) to end of service (tip), events branching off it,
 * proportional to their month offsets. Shared verbatim by the plan page and
 * the PDF export — zero dependencies (air-gap safe).
 */

const W = 880;
const CX = W / 2;
const CARD_W = 292;
const CARD_H = 58;
const ROW_GAP = 74;
const RECURRING_HORIZON = 36;

// brand palette (matches globals.css tokens)
const C = {
  spineTop: "#34d399",
  spineBottom: "#065f46",
  deep: "#064e3b",
  action: "#059669",
  mint: "#d1fae5",
  mist: "#ecfdf5",
  ink: "#1c1917",
  muted: "#78716c",
  border: "#e7e5e4",
  amber: "#d97706",
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// tiny embedded icon set (24×24 viewBox paths, stroke style)
const ICON = {
  flag: `<path d="M5 21V4h11l-2.5 4L16 12H5" fill="none" stroke="white" stroke-width="2" stroke-linejoin="round"/>`,
  target: `<circle cx="12" cy="12" r="8" fill="none" stroke="white" stroke-width="2"/><circle cx="12" cy="12" r="3.5" fill="white"/>`,
  repeat: `<path d="M4 12a8 8 0 0 1 14-5m2 5a8 8 0 0 1-14 5" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M18 3v4h-4M6 21v-4h4" fill="none" stroke="white" stroke-width="2" stroke-linejoin="round"/>`,
  rocket: `<path d="M12 3c3 2 4 6 4 9l2 3-3-1c-1 1-2 1.6-3 2-1-.4-2-1-3-2l-3 1 2-3c0-3 1-7 4-9z" fill="white"/><circle cx="12" cy="10" r="1.6" fill="${C.action}"/>`,
  leaf: `<path d="M6 18C6 10 12 5 19 4c-1 7-6 13-13 14z" fill="white"/>`,
};

type EventCard = {
  offset: number;
  title: string;
  sub: string;
  kind: "point" | "metric";
};

function iconDisc(kind: EventCard["kind"] | "repeat", cx: number, cy: number): string {
  const fill = kind === "point" ? C.action : kind === "metric" ? C.deep : C.amber;
  const icon = kind === "point" ? ICON.flag : kind === "metric" ? ICON.target : ICON.repeat;
  return `<g><circle cx="${cx}" cy="${cy}" r="16" fill="${fill}"/><g transform="translate(${cx - 11},${cy - 11}) scale(0.92)">${icon}</g></g>`;
}

export function buildPlanDiagramSvg(plan: PlanWithEvents): string {
  // ---- collect events ----
  const cards: EventCard[] = [];
  for (const e of plan.pointEvents) {
    cards.push({ offset: e.offsetMonths, title: e.label, sub: `${e.offsetMonths} חודשים מהגיוס`, kind: "point" });
  }
  for (const m of plan.cumulativeMetrics) {
    for (const c of m.checkpoints) {
      cards.push({
        offset: c.offsetMonths,
        title: `${m.name}: ${c.target} ${m.unit}`,
        sub: `יעד עד ${c.offsetMonths} חודשים מהגיוס`,
        kind: "metric",
      });
    }
  }
  cards.sort((a, b) => a.offset - b.offset);

  const recurring = plan.recurringEvents.map((r) => ({
    label: r.label,
    interval: r.intervalMonths,
    stop: r.stopMode === "UNTIL_OFFSET" ? `עד חודש ${r.stopOffsetMonths} מהגיוס` : "עד סוף השירות",
    offsets: unrollRecurring(r.intervalMonths, r.stopMode, r.stopOffsetMonths, RECURRING_HORIZON),
  }));

  const maxOffset = Math.max(
    1,
    ...cards.map((c) => c.offset),
    ...recurring.flatMap((r) => r.offsets),
  );

  // ---- vertical scale ----
  const perSide = Math.ceil(cards.length / 2);
  const H = Math.max(520, 210 + Math.max(maxOffset * 24, perSide * ROW_GAP + 120));
  const baseY = H - 96; // recruitment
  const tipY = 96; // arrowhead tip
  const shaftTop = tipY + 46;
  const y = (off: number) => baseY - (off / (maxOffset + 1.5)) * (baseY - shaftTop - 10);

  const parts: string[] = [];
  // NOTE: no direction="rtl" on the root — it inverts text-anchor semantics.
  // Hebrew runs render RTL via the Unicode bidi algorithm; anchors stay LTR-predictable.
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="Rubik,'Noto Sans Hebrew',sans-serif" style="max-width:100%;height:auto">`,
    `<defs><linearGradient id="spine" x1="0" y1="1" x2="0" y2="0">
       <stop offset="0" stop-color="${C.spineBottom}"/><stop offset="1" stop-color="${C.spineTop}"/>
     </linearGradient>
     <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
       <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#00000022"/>
     </filter></defs>`,
    `<rect width="${W}" height="${H}" fill="white"/>`,
    // title
    `<text x="${CX}" y="44" text-anchor="middle" font-size="22" font-weight="700" fill="${C.deep}">${esc(plan.name)}</text>`,
    `<text x="${CX}" y="66" text-anchor="middle" font-size="12" fill="${C.muted}">מסלול קריירה · ציר יחסי לתאריך הגיוס</text>`,
  );

  // ---- spine arrow ----
  parts.push(
    `<rect x="${CX - 14}" y="${shaftTop}" width="28" height="${baseY - shaftTop}" rx="10" fill="url(#spine)"/>`,
    `<polygon points="${CX - 30},${shaftTop + 6} ${CX + 30},${shaftTop + 6} ${CX},${tipY}" fill="${C.spineTop}"/>`,
    // tip: end-of-service + leaf
    `<g transform="translate(${CX + 38},${tipY + 2}) scale(0.9)"><g transform="scale(1)">${ICON.leaf.replace('fill="white"', `fill="${C.action}"`)}</g></g>`,
    `<text x="${CX}" y="${tipY - 14}" text-anchor="middle" font-size="14" font-weight="600" fill="${C.action}">סוף השירות</text>`,
    // base: recruitment chip (rocket inside, right of the text — Hebrew reads right→left)
    `<g filter="url(#soft)"><rect x="${CX - 74}" y="${baseY - 4}" width="148" height="42" rx="21" fill="${C.deep}"/></g>`,
    `<g transform="translate(${CX + 28},${baseY + 5}) scale(1.1)">${ICON.rocket}</g>`,
    `<text x="${CX - 10}" y="${baseY + 23}" text-anchor="middle" font-size="16" font-weight="700" fill="white">גיוס</text>`,
  );

  // ---- month tick lines on the shaft (labels drawn later, above connectors) ----
  for (let off = 0; off <= maxOffset; off += 6) {
    const yy = y(off);
    parts.push(
      `<line x1="${CX - 22}" y1="${yy}" x2="${CX + 22}" y2="${yy}" stroke="white" stroke-width="1.5" opacity="0.8"/>`,
    );
  }

  // ---- event cards, alternating sides, collision-nudged ----
  // Card-internal layout is identical on both sides (Hebrew reads right→left):
  // icon disc at the card's RIGHT edge, text right-aligned beside it.
  const lastY: Record<"R" | "L", number> = { R: baseY - 26, L: baseY - 26 };
  cards.forEach((card, i) => {
    const side: "R" | "L" = i % 2 === 0 ? "R" : "L";
    const anchorY = y(card.offset);
    const cardCy = Math.min(anchorY, lastY[side] - ROW_GAP);
    lastY[side] = cardCy;

    const cardX = side === "R" ? CX + 80 : CX - 80 - CARD_W;
    const innerEdge = side === "R" ? cardX : cardX + CARD_W;
    const discX = cardX + CARD_W - 30;
    const textX = cardX + CARD_W - 56;

    // text as real HTML (foreignObject): proper Hebrew bidi + ellipsis,
    // rendered identically by browsers and by Chromium's PDF print.
    parts.push(
      // elbow connector: spine → out → card
      `<path d="M ${CX} ${anchorY} h ${side === "R" ? 46 : -46} L ${innerEdge} ${cardCy}" fill="none" stroke="${C.border}" stroke-width="2"/>`,
      `<circle cx="${CX}" cy="${anchorY}" r="7" fill="white" stroke="${C.action}" stroke-width="3"/>`,
      // card
      `<g filter="url(#soft)"><rect x="${cardX}" y="${cardCy - CARD_H / 2}" width="${CARD_W}" height="${CARD_H}" rx="14" fill="${card.kind === "metric" ? C.mist : "white"}" stroke="${C.border}"/></g>`,
      iconDisc(card.kind, discX, cardCy),
      `<foreignObject x="${cardX + 10}" y="${cardCy - CARD_H / 2 + 6}" width="${CARD_W - 62}" height="${CARD_H - 10}">
         <div xmlns="http://www.w3.org/1999/xhtml" dir="rtl" style="font-family:Rubik,'Noto Sans Hebrew',sans-serif;height:100%;display:flex;flex-direction:column;justify-content:center;overflow:hidden">
           <div style="font-size:14px;font-weight:600;color:${C.ink};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(card.title)}</div>
           <div style="font-size:11px;color:${C.muted};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(card.sub)}</div>
         </div>
       </foreignObject>`,
    );
  });

  // ---- month tick labels, on top of connectors, with a white halo so
  // crossing lines never obscure them (0 skipped — the base chip says it) ----
  let topTickY = baseY;
  for (let off = 6; off <= maxOffset; off += 6) {
    const yy = y(off);
    topTickY = yy;
    parts.push(
      `<text x="${CX - 30}" y="${yy + 4}" text-anchor="end" font-size="11" fill="${C.muted}" stroke="white" stroke-width="4" paint-order="stroke">${off}</text>`,
    );
  }
  parts.push(
    `<text x="${CX - 30}" y="${topTickY - 16}" text-anchor="end" font-size="10" fill="${C.muted}" stroke="white" stroke-width="4" paint-order="stroke">חודשים</text>`,
  );

  // ---- recurring cadence markers ON TOP (amber diamonds — never hidden by
  // the cards' white connector dots at shared offsets) ----
  for (const r of recurring) {
    for (const off of r.offsets) {
      if (off > maxOffset) continue;
      const yy = y(off);
      parts.push(
        `<rect x="${CX - 6}" y="${yy - 6}" width="12" height="12" rx="2.5" transform="rotate(45 ${CX} ${yy})" fill="${C.amber}" stroke="white" stroke-width="2"/>`,
      );
    }
  }

  // ---- recurring legend (bottom corner, HTML for clean bidi) ----
  if (recurring.length > 0) {
    const lh = 26 + recurring.length * 20;
    parts.push(
      `<foreignObject x="16" y="${H - lh - 14}" width="330" height="${lh}">
         <div xmlns="http://www.w3.org/1999/xhtml" dir="rtl" style="font-family:Rubik,'Noto Sans Hebrew',sans-serif;font-size:12px">
           <div style="font-weight:600;color:${C.ink}">
             <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${C.amber};border:2px solid white;outline:1px solid ${C.border};transform:rotate(45deg);vertical-align:-2px;margin-left:6px"></span>
             אירועים מחזוריים לאורך המסלול:
           </div>
           ${recurring
             .map(
               (r) =>
                 `<div style="color:${C.muted};margin-top:4px">• ${esc(r.label)} — כל ${r.interval} חודשים, ${esc(r.stop)}</div>`,
             )
             .join("")}
         </div>
       </foreignObject>`,
    );
  }

  parts.push(`</svg>`);
  return parts.join("\n");
}
