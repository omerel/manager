"use client";

import { useMemo, useState } from "react";
import { Download, FileText, Presentation, X } from "lucide-react";
import { KIND_LABEL } from "@/lib/org-kinds";
import { UNASSIGNED_NODE_ID } from "@/lib/gap-meta";
import type { GapTreeNode } from "@/lib/gap-dashboard";

/** The tree, flattened for the checkbox list: id, depth and label, parents first. */
type Row = { id: string; depth: number; label: string; kind: string; parentId: string | null };

function flatten(roots: GapTreeNode[], depth = 0, parentId: string | null = null): Row[] {
  return roots.flatMap((n) => [
    { id: n.id, depth, label: n.name, kind: n.kind, parentId },
    ...flatten(n.children, depth + 1, n.id),
  ]);
}

/**
 * Choose what the exported pyramid shows, then download it.
 *
 * The form posts CHOICES — the chosen framework, the unticked ids, the two
 * toggles — and the server rebuilds the tree from the viewer's own visibility.
 * A native form POST means the browser saves the response as a file, with no
 * blob plumbing on this side.
 */
export function OrgExportDialog({ roots, node }: { roots: GapTreeNode[]; node: string }) {
  const [open, setOpen] = useState(false);
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const rows = useMemo(() => flatten(roots), [roots]);

  // unticking a node hides its whole subtree — reflect that in the list, so the
  // dialog shows what the drawing will show
  const descendantsOf = useMemo(() => {
    const byParent = new Map<string | null, Row[]>();
    for (const r of rows) {
      const arr = byParent.get(r.parentId) ?? [];
      arr.push(r);
      byParent.set(r.parentId, arr);
    }
    const walk = (id: string): string[] => (byParent.get(id) ?? []).flatMap((c) => [c.id, ...walk(c.id)]);
    return walk;
  }, [rows]);

  const hiddenByParent = useMemo(() => {
    const hidden = new Set<string>();
    for (const id of excluded) for (const d of descendantsOf(id)) hidden.add(d);
    return hidden;
  }, [excluded, descendantsOf]);

  const toggle = (id: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-stone-50"
      >
        <Download className="h-3.5 w-3.5" aria-hidden />
        ייצוא העץ
      </button>
    );
  }

  return (
    <>
      <button type="button" className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs" disabled>
        <Download className="h-3.5 w-3.5" aria-hidden />
        ייצוא העץ
      </button>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={() => setOpen(false)}>
        <div
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-2xl"
        >
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold text-brand-900">ייצוא עץ המבנה</h2>
            <button type="button" onClick={() => setOpen(false)} className="rounded p-1 text-muted hover:bg-stone-100" title="סגור">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <p className="mt-1 text-sm text-muted">
            הציור נוצר מהעץ המוצג — כולל הסינון הפעיל. בחר/י אילו ענפים להציג; הסרת מסגרת מסירה גם את כל שתחתיה,
            אך אינה משנה את הכמויות המוצגות.
          </p>

          <form action="/api/org-export" method="post" className="mt-4 space-y-4">
            <input type="hidden" name="node" value={node} />

            <div className="max-h-64 space-y-0.5 overflow-y-auto rounded-md border border-border p-2">
              {rows.map((r) => {
                const off = excluded.has(r.id) || hiddenByParent.has(r.id);
                return (
                  <label
                    key={r.id}
                    style={{ paddingInlineStart: `${r.depth * 16}px` }}
                    className={`flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-stone-50 ${off ? "opacity-45" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={!excluded.has(r.id)}
                      onChange={() => toggle(r.id)}
                      disabled={hiddenByParent.has(r.id)}
                    />
                    <span className="text-xs text-muted">
                      {r.id === UNASSIGNED_NODE_ID ? "ללא שיוך" : KIND_LABEL[r.kind as keyof typeof KIND_LABEL]}
                    </span>
                    <span>{r.label}</span>
                  </label>
                );
              })}
              {/* what the server must drop, carried as plain values */}
              {[...excluded].map((id) => (
                <input key={id} type="hidden" name="excluded" value={id} />
              ))}
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="showCommander" value="1" defaultChecked />
                הצג שם מפקד
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="showCount" value="1" defaultChecked />
                הצג כמות אנשים
              </label>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              <button
                type="submit"
                name="format"
                value="pptx"
                className="flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                <Presentation className="h-4 w-4" aria-hidden />
                PowerPoint
              </button>
              <button
                type="submit"
                name="format"
                value="pdf"
                className="flex items-center gap-1.5 rounded-md border border-border px-4 py-1.5 text-sm hover:bg-stone-50"
              >
                <FileText className="h-4 w-4" aria-hidden />
                PDF
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
