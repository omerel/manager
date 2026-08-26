import type { GapTreeNode } from "@/lib/gap-dashboard";

/**
 * Geometry for the exported org pyramid — one layout, two printers.
 *
 * PPTX shapes and the PDF's SVG are both drawn from the boxes and edges this
 * module returns, so the two files can never disagree about the picture. It
 * knows nothing about either format, and reaches no database: it takes the
 * tree the dashboard already built and returns coordinates.
 *
 * Two arrangements, chosen automatically:
 *
 *   SPREAD   children side by side under their parent — the classic pyramid,
 *            and what a small tree should look like
 *   STACKED  children in an indented column beneath the parent (RTL: indented
 *            leftward), the shape that keeps a WIDE org readable
 *
 * A real unit is 4 domains × 3 sections × 3 teams: spread all the way down
 * that is 7950 units wide against 450 tall, which on a page becomes an
 * unreadable 2px-font strip. So the layout is computed at every stacking depth
 * and the variant that survives page-fitting BEST is returned — small trees
 * keep the pyramid, wide ones stack their lower levels by themselves.
 */

export type ExportOptions = {
  /** node ids the user unticked — the node AND its subtree are dropped */
  excluded: Set<string>;
  showCommander: boolean;
  showCount: boolean;
};

export type ExportBox = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  name: string;
  /** commander line: null when hidden by option; "" when the framework has none */
  commander: string | null;
  /** count line: null when hidden by option */
  count: string | null;
};

/**
 * `tee` — down from the parent, across, down into the child (spread children).
 * `elbow` — down the parent's spine, then across into the child's side (stacked).
 */
export type ExportEdge = { fromX: number; fromY: number; toX: number; toY: number; style: "tee" | "elbow" };

export type ExportLayout = {
  title: string;
  boxes: ExportBox[];
  edges: ExportEdge[];
  width: number;
  height: number;
  /** depth from which children are stacked; Infinity = the plain pyramid */
  stackDepth: number;
};

/** Box geometry in layout units; the printers scale the whole drawing to fit. */
const BOX_W = 180;
const BOX_H_BASE = 34; // name only
const LINE_H = 16; // per optional line
const GAP_X = 18; // between spread siblings
const GAP_Y = 46; // between spread levels
const STACK_DX = 30; // how far a stacked child is indented from its parent
const STACK_TOP = 14; // from the parent's bottom to its first stacked child
const STACK_GAP = 8; // between stacked siblings
const PAD = 24; // around the drawing

/**
 * The page the layout is judged against — only its ASPECT matters, and it sits
 * between A4 landscape (~1.45) and a 16:9 slide (~1.78), so one decision suits
 * both files.
 */
const REF_W = 1600;
const REF_H = 1000;

/**
 * Drop unticked nodes with everything beneath them. Counts are NOT recomputed:
 * a box states its framework's real strength even when its sub-branches are
 * hidden — pruning is about what the slide shows, not about the numbers.
 */
export function pruneTree(roots: GapTreeNode[], excluded: Set<string>): GapTreeNode[] {
  return roots
    .filter((n) => !excluded.has(n.id))
    .map((n) => ({ ...n, children: pruneTree(n.children, excluded) }));
}

/** «עץ מבנה <שם השורש>» — the first root, which is the one the dashboard shows first. */
export function exportTitle(roots: GapTreeNode[]): string {
  return `עץ מבנה ${roots[0]?.name ?? "—"}`;
}

function boxHeight(opts: ExportOptions): number {
  return BOX_H_BASE + (opts.showCommander ? LINE_H : 0) + (opts.showCount ? LINE_H : 0);
}

/**
 * A label longer than its box is clipped, never shrunk to fit alone: text that
 * quietly changed size box to box would read as a broken drawing.
 *
 * The budgets are MEASURED, not guessed — average Hebrew advance in Arial is
 * 7.19px bold-14 and 5.23px regular-11, which over the box's 164 usable units
 * gives 22 and 31 characters. They hold at any scale, since box and type
 * shrink together.
 */
const NAME_CHARS = 22;
const LINE_CHARS = 30;
function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

function maxDepthOf(roots: GapTreeNode[], depth = 0): number {
  return roots.reduce((m, n) => Math.max(m, n.children.length ? maxDepthOf(n.children, depth + 1) : depth), depth);
}

/**
 * One arrangement, at a fixed stacking depth. `stackDepth` is the depth from
 * which children are placed in a column instead of side by side — Infinity
 * spreads the whole tree.
 */
function layoutAt(roots: GapTreeNode[], opts: ExportOptions, stackDepth: number): ExportLayout {
  const bh = boxHeight(opts);
  const boxes: ExportBox[] = [];
  const edges: ExportEdge[] = [];

  type Size = { w: number; h: number };
  const sizeCache = new Map<GapTreeNode, Size>();
  const size = (n: GapTreeNode, depth: number): Size => {
    const hit = sizeCache.get(n);
    if (hit) return hit;
    let out: Size;
    if (n.children.length === 0) {
      out = { w: BOX_W, h: bh };
    } else if (depth + 1 >= stackDepth) {
      const kids = n.children.map((c) => size(c, depth + 1));
      out = {
        w: Math.max(BOX_W, STACK_DX + Math.max(...kids.map((k) => k.w))),
        h: bh + STACK_TOP + kids.reduce((s, k) => s + k.h, 0) + STACK_GAP * (kids.length - 1),
      };
    } else {
      const kids = n.children.map((c) => size(c, depth + 1));
      out = {
        w: Math.max(BOX_W, kids.reduce((s, k) => s + k.w, 0) + GAP_X * (kids.length - 1)),
        h: bh + GAP_Y + Math.max(...kids.map((k) => k.h)),
      };
    }
    sizeCache.set(n, out);
    return out;
  };

  const emit = (n: GapTreeNode, x: number, y: number) =>
    boxes.push({
      id: n.id,
      x,
      y,
      w: BOX_W,
      h: bh,
      name: clip(n.name, NAME_CHARS),
      // the line is KEPT (empty) when the option is on and the framework has no
      // commander, so every box on a row is the same height
      commander: opts.showCommander ? clip(n.commander ?? "", LINE_CHARS) : null,
      count: opts.showCount ? `${n.total} אנשים` : null,
    });

  /** `left`/`top` are the subtree's own bounding box. */
  const place = (n: GapTreeNode, left: number, top: number, depth: number) => {
    const me = size(n, depth);

    if (n.children.length === 0) {
      emit(n, left + (me.w - BOX_W) / 2, top);
      return;
    }

    if (depth + 1 >= stackDepth) {
      // RTL indent: the parent sits at the group's RIGHT edge and its children
      // hang leftward beneath it, the way a Hebrew list reads
      const parentX = left + me.w - BOX_W;
      emit(n, parentX, top);
      const spineX = parentX + BOX_W - 16;
      let cy = top + bh + STACK_TOP;
      for (const c of n.children) {
        const cs = size(c, depth + 1);
        const cLeft = left + me.w - STACK_DX - cs.w;
        edges.push({ fromX: spineX, fromY: top + bh, toX: cLeft + cs.w, toY: cy + bh / 2, style: "elbow" });
        place(c, cLeft, cy, depth + 1);
        cy += cs.h + STACK_GAP;
      }
      return;
    }

    const span = n.children.reduce((s, c) => s + size(c, depth + 1).w, 0) + GAP_X * (n.children.length - 1);
    const cx = left + me.w / 2;
    emit(n, cx - BOX_W / 2, top);
    let cLeft = left + (me.w - span) / 2;
    const childTop = top + bh + GAP_Y;
    for (const c of n.children) {
      const cs = size(c, depth + 1);
      edges.push({ fromX: cx, fromY: top + bh, toX: cLeft + cs.w / 2, toY: childTop, style: "tee" });
      place(c, cLeft, childTop, depth + 1);
      cLeft += cs.w + GAP_X;
    }
  };

  let rootLeft = PAD;
  for (const r of roots) {
    place(r, rootLeft, PAD, 0);
    rootLeft += size(r, 0).w + GAP_X;
  }

  const width = boxes.length ? Math.max(...boxes.map((b) => b.x + b.w)) + PAD : 2 * PAD;
  const height = boxes.length ? Math.max(...boxes.map((b) => b.y + b.h)) + PAD : 2 * PAD;
  return { title: exportTitle(roots), boxes, edges, width, height, stackDepth };
}

/** How well a drawing survives being fitted to the reference page — bigger is more readable. */
export function pageFit(layout: { width: number; height: number }): number {
  return Math.min(REF_W / layout.width, REF_H / layout.height);
}

/**
 * The layout the export uses.
 *
 * The pyramid comes first and STAYS whenever it fits the page at full size —
 * rearranging a small tree that was already fine would be a change nobody
 * asked for. Only when the drawing would have to be shrunk to fit does the
 * layout look for a better arrangement, trying each stacking depth from the
 * deepest level upwards (the least intrusive change first) and keeping the
 * most readable. That is the "many frameworks" threshold, expressed as the
 * thing it is really about: whether the picture still reads.
 */
export function layoutTree(roots: GapTreeNode[], opts: ExportOptions): ExportLayout {
  const spread = layoutAt(roots, opts, Infinity);
  let bestFit = pageFit(spread);
  if (bestFit >= 1) return spread;

  let best = spread;
  for (let d = maxDepthOf(roots); d >= 1; d--) {
    const candidate = layoutAt(roots, opts, d);
    const fit = pageFit(candidate);
    if (fit > bestFit * 1.05) {
      best = candidate;
      bestFit = fit;
    }
  }
  return best;
}
