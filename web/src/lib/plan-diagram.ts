import type { PlanWithEvents } from "@/lib/plans";
import { unrollRecurring } from "@/lib/plans";
import { formatYearsMonths, monthsAsWords } from "@/lib/years-months";
import { softColorFor } from "@/lib/palette";

/**
 * Pure SVG-string builder for the career-path diagram: a large upward arrow
 * from unit placement (base) to end of service (tip), events branching off it,
 * proportional to their month offsets. Shared verbatim by the plan page and
 * the PDF export — zero dependencies (air-gap safe).
 */

const W = 880;
const CX = W / 2;
const CARD_W = 292;
const CARD_H = 58;
const ROW_GAP = 74;

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
  kind: "point" | "metric" | "recurring";
  /** per-metric soft colour; point events use the brand green */
  bg?: string;
  accent?: string;
  border?: string;
  /** this person's standing against the item, when the diagram is drawn for one */
  status?: VectorStatus;
  /** added for this person alone — drawn with its own marker */
  personal?: boolean;
};

/**
 * How one person stands against one plan item. Passed in only when the diagram
 * is drawn on a person's card; the plan page and the PDF pass nothing and get
 * exactly the drawing they got before.
 */
/**
 * NOT_DUE is not a new idea: `gap-engine` has always defined ⬜ future as one of
 * the three states, and `GapLevel` carries it. The drawing was the only place
 * that lost it — it mapped FUTURE onto MET, so an item nobody had reached yet
 * was painted in the colour of an item already done.
 */
export type VectorStatus = "OVERDUE" | "APPROACHING" | "MET" | "NOT_DUE" | "WAIVED" | "WATCHED";

/**
 * How one drawn occurrence of a recurring event is addressed in the status map.
 *
 * The map's keys are the things the diagram DRAWS, so the key format is part of
 * this module's input contract and lives with it — a point event or a metric
 * checkpoint is keyed by its bare id, and a recurring event, which is drawn once
 * per occurrence, by event and offset together.
 *
 * Written by hand at each call site it would be one typo from a silent miss: a
 * lookup that finds nothing falls back to the palette colour, so the item would
 * look plausible and be wrong. A cuid contains no `:`, so an occurrence key can
 * never collide with a bare id in the same map.
 */
export function occurrenceKey(recurringEventId: string, offsetMonths: number): string {
  return `${recurringEventId}:${offsetMonths}`;
}

/**
 * The key to the colours, stated once and read by everyone who shows them —
 * the card's legend line and the PDF's. Two hand-written lists of the same
 * colours is how a legend comes to disagree with its drawing.
 */
export const VECTOR_LEGEND: { status: VectorStatus; label: string }[] = [
  { status: "OVERDUE", label: "פער" },
  { status: "APPROACHING", label: "מתקרב" },
  { status: "MET", label: "תקין" },
  { status: "NOT_DUE", label: "טרם הגיע" },
  { status: "WAIVED", label: "פטור" },
  // «פער במעקב» and not «במעקב» alone: the word פער has to stay in the label,
  // because the one thing a reader must not conclude is that this is an
  // exemption. A waiver leaves the count; a watch does not.
  { status: "WATCHED", label: "פער במעקב" },
];

/**
 * Colours per status — the same vocabulary the badges use, in the drawing's palette.
 *
 * NOT_DUE and WAIVED are both grey, and deliberately not the SAME grey: waived
 * is dimmed to .55 on top of its colour and means "never asked of this person",
 * while not-yet-due is at full strength and means "asked, just not yet". A
 * slate cast against the waived stone keeps the two readable side by side.
 * Its border and accent carry the weight — a light background alone would
 * vanish into the drawing's white.
 */
export const STATUS_STYLE: Record<VectorStatus, { bg: string; accent: string; border: string }> = {
  OVERDUE: { bg: "#fef2f2", accent: "#dc2626", border: "#fca5a5" },
  APPROACHING: { bg: "#fffbeb", accent: "#d97706", border: "#fcd34d" },
  MET: { bg: "#ecfdf5", accent: "#059669", border: "#6ee7b7" },
  NOT_DUE: { bg: "#f8fafc", accent: "#64748b", border: "#94a3b8" },
  WAIVED: { bg: "#fafaf9", accent: "#a8a29e", border: "#e7e5e4" },
  // Orange, as asked. The collision to worry about is NOT red — it is
  // APPROACHING's amber (#d97706), an adjacent hue. So colour is not left to
  // carry this alone: a watched card also gets the eye glyph below, which reads
  // whether or not the viewer is comparing two oranges side by side.
  WATCHED: { bg: "#fff7ed", accent: "#ea580c", border: "#fb923c" },
};

/**
 * Movement is reserved for the states that ask for action — a drawing where
 * everything pulses says nothing. Held inside a reduced-motion guard, so the
 * static, colour-only version is what a viewer who asked for less motion gets;
 * no JavaScript is involved either way.
 */
const ANIMATION_CSS = `
  .vs-overdue .vs-ring { opacity: 0; }
  .vs-approach .vs-ring { opacity: 0; }
  @media (prefers-reduced-motion: no-preference) {
    @keyframes vsPulse { 0%,100% { opacity: 0; r: 16; } 50% { opacity: .55; r: 27; } }
    @keyframes vsGlow  { 0%,100% { opacity: 0; r: 16; } 50% { opacity: .30; r: 23; } }
    .vs-overdue .vs-ring  { animation: vsPulse 2s ease-in-out infinite; }
    .vs-approach .vs-ring { animation: vsGlow 3s ease-in-out infinite; }
  }
  .vs-waived { opacity: .55; }
  /* No halo for WATCHED, deliberately: movement is for what asks to be acted on,
     and an acknowledged gap has already been acted on once. It stays orange and
     stays counted. */
  /* print captures one arbitrary frame of a loop, so the halo would land at a
     random opacity in the PDF. The colour carries the meaning on paper. */
  @media print { .vs-ring { display: none; } }
`;

/**
 * The mark that says "known, and still owed" — an eye, drawn rather than
 * coloured so it reads in greyscale and beside the amber it sits next to.
 */
function watchEye(cx: number, cy: number): string {
  const c = STATUS_STYLE.WATCHED.accent;
  return (
    `<g><ellipse cx="${cx}" cy="${cy}" rx="9" ry="6" fill="white" stroke="${c}" stroke-width="2"/>` +
    `<circle cx="${cx}" cy="${cy}" r="2.6" fill="${c}"/></g>`
  );
}

/** The mark that says "this one is yours" — a shape, so it survives any palette. */
function personalStar(cx: number, cy: number): string {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? 12 : 5.2;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
  // the white disc behind it keeps the star legible over a connector or a card
  return (
    `<circle cx="${cx}" cy="${cy}" r="13" fill="white"/>` +
    `<polygon points="${pts}" fill="#fbbf24" stroke="#b45309" stroke-width="1.4"><title>אירוע אישי</title></polygon>`
  );
}

function iconDisc(kind: EventCard["kind"] | "repeat", cx: number, cy: number, fill?: string): string {
  const disc = fill ?? (kind === "point" ? C.action : kind === "metric" ? C.deep : C.amber);
  const icon = kind === "point" ? ICON.flag : kind === "metric" ? ICON.target : ICON.repeat;
  return `<g><circle cx="${cx}" cy="${cy}" r="16" fill="${disc}"/><g transform="translate(${cx - 11},${cy - 11}) scale(0.92)">${icon}</g></g>`;
}

/**
 * @param status per-item standing, keyed by the item's own id (point event,
 *   checkpoint, or recurring event). Omitted on the plan page and in the PDF,
 *   where the drawing describes the TRACK and nobody's standing against it.
 */
function renderDiagram(
  plan: PlanWithEvents,
  status?: Map<string, VectorStatus>,
  /**
   * The occurrences of each recurring event, per event id — what THIS PERSON is
   * actually asked for. Given only when drawing for a person; the plan page
   * omits it and the full schedule is unrolled as before.
   *
   * It exists because the two were computed separately and disagreed: the
   * diagram unrolled the template's schedule while the status was computed from
   * `unrollForPerson`, which clips at end of service. Everything past the clip
   * was drawn with no status and fell back to the event's palette colour — a
   * colour no standing produced. Passing the list in, rather than passing the
   * dates and unrolling again here, is the point: a second unroll is a second
   * chance to disagree.
   */
  occurrences?: Map<string, number[]>,
): { svg: string; missingStatus: string[] } {
  // when a status is given it REPLACES the palette colour: the card must say
  // how this person stands, not which metric it belongs to
  const missingStatus: string[] = [];
  const styled = (id: string, fallback: { bg?: string; accent?: string; border?: string }) => {
    const s = status?.get(id);
    if (s) return { ...STATUS_STYLE[s], status: s };
    // No map at all is the plan page, and the fallback is correct there. A map
    // that is missing THIS item is a fault: the drawing and the status were
    // computed from different lists. Recorded rather than thrown — a colour
    // fault is not worth collapsing a commander's whole card over — so a test
    // can catch what a viewer would only see as an oddly coloured disc.
    if (status) missingStatus.push(id);
    return fallback;
  };

  // ---- collect events ----
  const cards: EventCard[] = [];
  for (const e of plan.pointEvents) {
    cards.push({
      offset: e.offsetMonths,
      title: e.label,
      sub: `${formatYearsMonths(e.offsetMonths)} מההצבה (${monthsAsWords(e.offsetMonths)})`,
      kind: "point",
      personal: e.personal,
      ...styled(e.id, {}),
    });
  }
  plan.cumulativeMetrics.forEach((m, mi) => {
    const col = softColorFor(m.color, mi); // one colour per metric, shared by all its checkpoints
    for (const c of m.checkpoints) {
      cards.push({
        offset: c.offsetMonths,
        title: `${m.name}: ${c.target} ${m.unit}`,
        sub: `יעד עד ${formatYearsMonths(c.offsetMonths)} מההצבה`,
        kind: "metric",
        ...styled(c.id, { bg: col.bg, accent: col.accent, border: col.border }),
      });
    }
  });

  // A recurring event is drawn ONE way, never both: markers on the axis, or a
  // card at each occurrence. The split happens here so nothing downstream has
  // to remember the rule.
  const allRecurring = plan.recurringEvents.map((r, ri) => {
    const col = softColorFor(r.color, ri);
    return {
      id: r.id,
      label: r.label,
      interval: r.intervalMonths,
      stop: `מ-${formatYearsMonths(r.startOffsetMonths)} עד ${formatYearsMonths(r.stopOffsetMonths ?? 0)} מההצבה`,
      // the person's own list when drawing for a person; the track's otherwise
      offsets: occurrences?.get(r.id) ?? unrollRecurring(r.intervalMonths, r.stopOffsetMonths, r.startOffsetMonths),
      // the event's own definition, kept so the legend can tell whether the
      // markers drawn are the whole of it
      planStart: r.startOffsetMonths,
      planStop: r.stopOffsetMonths,
      // the event's OWN colour, which is its identity in the legend and never a
      // status: an occurrence's standing is asked for one occurrence at a time
      palette: { accent: col.accent, bg: col.bg, border: col.border },
      asCards: r.display === "CARD",
    };
  });
  const recurring = allRecurring.filter((r) => !r.asCards);
  for (const r of allRecurring.filter((r) => r.asCards)) {
    for (const off of r.offsets) {
      cards.push({
        offset: off,
        title: r.label,
        sub: `${formatYearsMonths(off)} מההצבה · כל ${r.interval} חודשים`,
        kind: "recurring",
        // asked per OCCURRENCE: this event's other occurrences have their own
        // dates and their own filed content, and say nothing about this one
        ...styled(occurrenceKey(r.id, off), r.palette),
      });
    }
  }
  cards.sort((a, b) => a.offset - b.offset);

  // ---- event-ordinal axis ----
  // Positions come from the *sequence* of months in which something happens,
  // not from calendar distance: a plan running to 72 months must not be twice
  // as tall as one running to 36. Each slot is labelled with its month; only
  // the jump from placement to the first one is marked, since the labels
  // already tell the reader the spacing is not proportional.
  const cardsByMonth = new Map<number, EventCard[]>();
  for (const c of cards) {
    const list = cardsByMonth.get(c.offset) ?? [];
    list.push(c);
    cardsByMonth.set(c.offset, list);
  }

  // Recurring cadence is drawn only across the span the plan's concrete events
  // occupy — first point/checkpoint to last. A recurrence that runs for years
  // past the final milestone would otherwise stretch the drawing with markers
  // that say nothing about the path itself. A plan with no cards at all is the
  // exception: then the recurrences are the whole story, so all are shown.
  const cardMonths = cards.map((c) => c.offset).filter((m) => m > 0);
  const firstCard = cardMonths.length ? Math.min(...cardMonths) : null;
  const lastCard = cardMonths.length ? Math.max(...cardMonths) : null;
  const inCardSpan = (m: number) => firstCard == null || (m >= firstCard && m <= lastCard!);
  const shownRecurrences = recurring.flatMap((r) => r.offsets).filter(inCardSpan);

  const slotMonths = [...new Set([...cardMonths, ...shownRecurrences])]
    .filter((m) => m > 0) // month 0 coincides with the placement chip itself
    .sort((a, b) => a - b);

  const BREAK_GAP = 52; // room between the placement chip and the first slot
  const TOP_ZONE = 190; // title, arrowhead and breathing room above the last slot
  // a slot only grows when more than two cards share a month, which is rare;
  // in the normal case every slot is one row and the ticks are evenly spaced
  const rowsIn = (m: number) => Math.max(1, Math.ceil((cardsByMonth.get(m)?.length ?? 0) / 2));
  const slotH = (m: number) => rowsIn(m) * ROW_GAP;

  const stack = slotMonths.reduce((s, m) => s + slotH(m), 0);
  const H = Math.max(520, 96 + BREAK_GAP + stack + TOP_ZONE);
  const baseY = H - 96; // unit placement
  const tipY = 96; // arrowhead tip
  const shaftTop = tipY + 46;

  // lay the slots out upward from the base, and remember each one's centre
  const slotY = new Map<number, number>();
  let cursor = baseY - BREAK_GAP;
  for (const m of slotMonths) {
    const h = slotH(m);
    cursor -= h;
    slotY.set(m, cursor + h / 2);
  }
  const y = (off: number) => slotY.get(off) ?? baseY;

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
    // emitted ONLY for a person's vector: without it the plan page and the PDF
    // are byte-identical to what they were before this change
    status ? `<style>${ANIMATION_CSS}</style>` : "",
    `<rect width="${W}" height="${H}" fill="white"/>`,
    // title
    `<text x="${CX}" y="44" text-anchor="middle" font-size="22" font-weight="700" fill="${C.deep}">${esc(plan.name)}</text>`,
    `<text x="${CX}" y="66" text-anchor="middle" font-size="12" fill="${C.muted}">מסלול קריירה · ציר לפי אירועים, בשנים.חודשים מההצבה ביחידה (המרווחים אינם פרופורציוניים)</text>`,
  );

  // ---- spine arrow ----
  parts.push(
    `<rect x="${CX - 14}" y="${shaftTop}" width="28" height="${baseY - shaftTop}" rx="10" fill="url(#spine)"/>`,
    `<polygon points="${CX - 30},${shaftTop + 6} ${CX + 30},${shaftTop + 6} ${CX},${tipY}" fill="${C.spineTop}"/>`,
    // tip: end-of-service + leaf
    `<g transform="translate(${CX + 38},${tipY + 2}) scale(0.9)"><g transform="scale(1)">${ICON.leaf.replace('fill="white"', `fill="${C.action}"`)}</g></g>`,
    `<text x="${CX}" y="${tipY - 14}" text-anchor="middle" font-size="14" font-weight="600" fill="${C.action}">סוף השירות</text>`,
    // base: unit-placement chip — the plan's origin (rocket inside, right of the text)
    `<g filter="url(#soft)"><rect x="${CX - 74}" y="${baseY - 4}" width="148" height="42" rx="21" fill="${C.deep}"/></g>`,
    `<g transform="translate(${CX + 28},${baseY + 5}) scale(1.1)">${ICON.rocket}</g>`,
    `<text x="${CX - 10}" y="${baseY + 23}" text-anchor="middle" font-size="16" font-weight="700" fill="white">הצבה</text>`,
  );

  // ---- slot ticks, and the one break marker ----
  // Only the jump from placement to the first event month is marked. A notch
  // between every pair of slots was noise: with labelled ticks it repeated on
  // nearly every boundary and read as texture rather than information.
  const breakMark = (yy: number, w: number) =>
    `<path d="M ${CX - w} ${yy + 5} l ${w * 0.8} -10 M ${CX - w * 0.1} ${yy + 5} l ${w * 0.8} -10" ` +
    `fill="none" stroke="white" stroke-width="3" stroke-linecap="round" opacity="0.95"/>`;

  if (slotMonths.length > 0) {
    parts.push(breakMark(baseY - BREAK_GAP / 2 - 4, 20));
    for (const m of slotMonths) {
      const yy = y(m);
      parts.push(
        `<line x1="${CX - 22}" y1="${yy}" x2="${CX + 22}" y2="${yy}" stroke="white" stroke-width="1.5" opacity="0.8"/>`,
      );
    }
  }

  // ---- event cards: one row per slot, alternating sides within the slot ----
  // Card-internal layout is identical on both sides (Hebrew reads right→left):
  // icon disc at the card's RIGHT edge, text right-aligned beside it.
  const placed = slotMonths.flatMap((m) => {
    const list = cardsByMonth.get(m) ?? [];
    const centre = y(m);
    const h = slotH(m);
    return list.map((card, i) => ({
      card,
      side: (i % 2 === 0 ? "R" : "L") as "R" | "L",
      anchorY: centre,
      // rows only appear when >2 cards share a month; the first row sits at the
      // bottom of the slot, so a single card lands exactly on its tick
      cardCy: centre + h / 2 - ROW_GAP / 2 - Math.floor(i / 2) * ROW_GAP,
    }));
  });

  placed.forEach(({ card, side, anchorY, cardCy }) => {
    const cardX = side === "R" ? CX + 80 : CX - 80 - CARD_W;
    const innerEdge = side === "R" ? cardX : cardX + CARD_W;
    const discX = cardX + CARD_W - 30;

    // text as real HTML (foreignObject): proper Hebrew bidi + ellipsis,
    // rendered identically by browsers and by Chromium's PDF print.
    // the status class carries both the animation and the waived dimming; with
    // no status given the group is unclassed and looks exactly as it always did
    const cls =
      card.status === "OVERDUE" ? "vs-overdue" :
      card.status === "APPROACHING" ? "vs-approach" :
      card.status === "WAIVED" ? "vs-waived" : "";

    parts.push(
      `<g class="${cls}">`,
      // elbow connector: spine → out → card
      `<path d="M ${CX} ${anchorY} h ${side === "R" ? 46 : -46} L ${innerEdge} ${cardCy}" fill="none" stroke="${card.border ?? C.border}" stroke-width="2"/>`,
      `<circle cx="${CX}" cy="${anchorY}" r="7" fill="white" stroke="${card.accent ?? C.action}" stroke-width="3"/>`,
      // card
      `<g filter="url(#soft)"><rect x="${cardX}" y="${cardCy - CARD_H / 2}" width="${CARD_W}" height="${CARD_H}" rx="14" fill="${card.bg ?? (card.kind === "metric" ? C.mist : "white")}" stroke="${card.border ?? C.border}"/></g>`,
      // the halo that pulses, drawn beneath the disc. Emitted ONLY for the two
      // states that animate: without it the plan page and the PDF keep exactly
      // the markup they had before this change.
      card.status === "OVERDUE" || card.status === "APPROACHING"
        ? `<circle class="vs-ring" cx="${discX}" cy="${cardCy}" r="16" fill="none" stroke="${card.accent ?? C.action}" stroke-width="3" opacity="0"/>`
        : "",
      // A SHAPE for "acknowledged", so the state survives a reader who cannot
      // separate orange from amber — and survives a greyscale print. Appended to
      // the disc's own string rather than added as a slot: the parts are joined
      // with newlines, so a new slot would add a blank line per card and drift
      // the status-less golden by exactly the number of cards drawn.
      iconDisc(card.kind, discX, cardCy, card.accent) +
        (card.status === "WATCHED" ? watchEye(side === "R" ? cardX - 15 : cardX + CARD_W + 15, cardCy) : ""),
      // a personal event says so by its SHAPE, so it reads even in one colour.
      // Placed on the card's OUTER edge — away from the spine — because the
      // inside is the text block's, and a star there lands under a long label.
      card.personal ? personalStar(side === "R" ? cardX - 15 : cardX + CARD_W + 15, cardCy) : "",
      `<foreignObject x="${cardX + 10}" y="${cardCy - CARD_H / 2 + 6}" width="${CARD_W - 62}" height="${CARD_H - 10}">
         <div xmlns="http://www.w3.org/1999/xhtml" dir="rtl" style="font-family:Rubik,'Noto Sans Hebrew',sans-serif;height:100%;display:flex;flex-direction:column;justify-content:center;overflow:hidden">
           <div style="font-size:14px;font-weight:600;color:${C.ink};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(card.title)}</div>
           <div style="font-size:11px;color:${C.muted};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(card.sub)}</div>
         </div>
       </foreignObject>`,
      `</g>`,
    );
  });

  // ---- recurring cadence markers fan out sideways around the axis; the time
  // labels must clear the WHOLE fan, whose width grows with the number of
  // recurring events — with a fixed label x, six events were enough for the
  // leftmost diamonds (drawn later, i.e. on top) to swallow the text ----
  const fanStep = 15;
  const fanBase = -((recurring.length - 1) / 2) * fanStep;
  const fanHalf = recurring.length > 0 ? ((recurring.length - 1) / 2) * fanStep + 9 : 0; // + half a diamond's diagonal
  const tickX = CX - Math.max(30, fanHalf + 12);

  // ---- month labels, on top of connectors, with a white halo so crossing
  // lines never obscure them (0 skipped — the base chip says it) ----
  let topTickY = baseY;
  for (const m of slotMonths) {
    const yy = y(m);
    topTickY = yy;
    parts.push(
      // direction=ltr is load-bearing: the page is RTL, and an SVG <text> inherits
      // it — under RTL, text-anchor="end" extends the text to the RIGHT of the
      // anchor, straight into the diamond fan. This was the real cause of the
      // swallowed labels; the fan-width clearance alone did not fix it.
      `<text x="${tickX}" y="${yy + 4}" direction="ltr" text-anchor="end" font-size="11" fill="${C.muted}" stroke="white" stroke-width="4" paint-order="stroke">${formatYearsMonths(m)}</text>`,
    );
  }
  parts.push(
    `<text x="${tickX}" y="${topTickY - 16}" direction="ltr" text-anchor="end" font-size="10" fill="${C.muted}" stroke="white" stroke-width="4" paint-order="stroke">שנים.חודשים</text>`,
  );

  // ---- recurring cadence markers ON TOP (diamonds — never hidden by the
  // cards' white connector dots at shared offsets). Each event keeps its own
  // colour, and several events are fanned out sideways so markers that land on
  // the same month stay visible side by side. ----
  recurring.forEach((r, ri) => {
    const mx = CX + fanBase + ri * fanStep;
    for (const off of r.offsets) {
      if (!slotY.has(off)) continue; // every occurrence has a slot; guards month 0
      const yy = y(off);
      // per occurrence, exactly as the card mode is: the two ways of drawing a
      // recurring event are two pictures of the same fact, and must agree
      const fill = styled(occurrenceKey(r.id, off), r.palette).accent;
      parts.push(
        `<rect x="${mx - 6}" y="${yy - 6}" width="12" height="12" rx="2.5" transform="rotate(45 ${mx} ${yy})" fill="${fill}" stroke="white" stroke-width="2"/>`,
      );
    }
  });

  // ---- recurring legend (bottom corner, HTML for clean bidi) ----
  // Each entry states the event's real definition; when the drawing shows only
  // part of it, the legend says so rather than letting the diagram imply that
  // the recurrence ends where the markers do.
  //
  // Only marker-drawn events appear here. An event drawn as cards carries its
  // own label at every occurrence, so a legend row for it would be a second,
  // redundant key — and the header would be claiming markers that do not exist.
  if (recurring.length > 0) {
    // Two reasons the markers can stop short of what the legend rows describe,
    // and the note must cover BOTH — its whole purpose is to stop the drawing
    // from implying that the recurrence ends where the markers do.
    //
    //   span   the marker span is narrower than the plan's concrete events
    //   person this person's occurrences were clipped — they leave first
    //
    // The second arrived with per-person occurrence lists. Without it the
    // legend would say "every 6 months until year 6" beside a drawing that
    // stops at year 1.6, and nothing would explain the gap.
    const clippedBySpan =
      firstCard != null && recurring.some((r) => r.offsets.some((o) => !inCardSpan(o)));
    const clippedByPerson = recurring.some(
      (r) => r.offsets.length < unrollRecurring(r.interval, r.planStop, r.planStart).length,
    );
    const clipped = clippedBySpan || clippedByPerson;
    // Fixed row metrics, because the swatches beside each row are drawn as SVG
    // and have to line up with text laid out by the browser.
    const ROW_H = 20;
    const lh = ROW_H * (1 + recurring.length) + (clipped ? 20 : 0) + 6;
    const legendX = 16;
    const legendW = 330; // narrower would wrap a row and push the closing note out of the box
    const legendY = H - lh - 14;
    const markX = legendX + legendW - 11; // leading edge in RTL, clear of the הצבה chip

    // Every graphic in the legend is a real SVG element; the foreignObject
    // carries text only. HTML inside a foreignObject cannot be relied on to
    // draw: a nested <svg> ballooned to fill the corner in Chromium's PDF
    // print, and a rotated <span> swatch simply did not render in another
    // browser. Text is what foreignObject is genuinely good at (Hebrew bidi),
    // so that is all it is asked to do.
    const rowCy = (i: number) => legendY + ROW_H * (1 + i) + ROW_H / 2;

    // category badge, on the header line
    parts.push(
      `<g><circle cx="${markX - 1}" cy="${legendY + ROW_H / 2}" r="9" fill="${C.deep}"/>` +
        `<g transform="translate(${markX - 7.2},${legendY + ROW_H / 2 - 6.2}) scale(0.52)">${ICON.repeat}</g></g>`,
    );
    // one diamond per event, in its own colour — the key that maps a legend row
    // to its markers on the spine. Deliberately the EVENT's palette colour and
    // never a status: this diamond answers "which event is this row?", while the
    // diamonds on the spine answer "how does this person stand at this
    // occurrence?". Colouring this one by status would collapse two questions.
    recurring.forEach((r, i) => {
      const cy = rowCy(i);
      parts.push(
        `<rect x="${markX - 5}" y="${cy - 5}" width="10" height="10" rx="2" ` +
          `transform="rotate(45 ${markX} ${cy})" fill="${r.palette.accent}" stroke="white" stroke-width="2"/>`,
      );
    });

    parts.push(
      `<foreignObject x="${legendX}" y="${legendY}" width="${legendW}" height="${lh}">
         <div xmlns="http://www.w3.org/1999/xhtml" dir="rtl" style="font-family:Rubik,'Noto Sans Hebrew',sans-serif;font-size:12px">
           <div style="font-weight:600;color:${C.ink};height:${ROW_H}px;line-height:${ROW_H}px;padding-right:22px">אירועים מחזוריים המסומנים על הציר:</div>
           ${recurring
             .map(
               (r) =>
                 `<div style="color:${C.muted};height:${ROW_H}px;line-height:${ROW_H}px;padding-right:22px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">` +
                 `${esc(r.label)} — כל ${r.interval} חודשים, ${esc(r.stop)}</div>`,
             )
             .join("")}
           ${
             clipped
               ? `<div style="color:${C.muted};height:20px;line-height:20px;font-size:11px">${
                   clippedByPerson
                     ? "הסימונים מוצגים עד סיום השירות; מופעים שלאחריו אינם נדרשים."
                     : `הסימונים מוצגים בטווח האירועים: ${formatYearsMonths(firstCard!)} עד ${formatYearsMonths(lastCard!)}.`
                 }</div>`
               : ""
           }
         </div>
       </foreignObject>`,
    );
  }

  parts.push(`</svg>`);
  return { svg: parts.join("\n"), missingStatus };
}

/**
 * The drawing. Unchanged for every caller — the plan page, the person's card
 * and both PDF routes all want the SVG and nothing else.
 */
export function buildPlanDiagramSvg(
  plan: PlanWithEvents,
  status?: Map<string, VectorStatus>,
  occurrences?: Map<string, number[]>,
): string {
  return renderDiagram(plan, status, occurrences).svg;
}

/**
 * Every item the drawing rendered that the status map had no entry for.
 *
 * Reported from the RENDER itself rather than recomputed alongside it: a
 * parallel computation of "what gets drawn" is exactly the shape of the fault
 * this exists to catch — the diagram unrolled one list while the status was
 * built from another, and nobody compared them. Empty is the only healthy
 * answer whenever a status map is given.
 */
export function planDiagramStatusGaps(
  plan: PlanWithEvents,
  status: Map<string, VectorStatus>,
  occurrences?: Map<string, number[]>,
): string[] {
  return renderDiagram(plan, status, occurrences).missingStatus;
}
