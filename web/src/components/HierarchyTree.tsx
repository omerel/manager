"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { KIND_LABEL, type OrgKindStr } from "@/lib/org-kinds";
import { updateOrgNode, removeOrgNode, type OrgEditState } from "@/lib/org-actions";
import { ConfirmDelete, plural } from "@/components/ConfirmDelete";

export type HierarchyNode = {
  id: string;
  name: string;
  kind: OrgKindStr;
  parentId: string | null;
  /** people attached directly to this node (teams only, in practice) */
  direct: number;
  /** name of the user who commands this framework, if anyone does */
  commander?: string | null;
};

type ParentOption = { id: string; label: string };

const inputCls = "rounded-md border border-border px-2 py-1 text-sm";
const KINDS: OrgKindStr[] = ["CENTER", "DOMAIN", "SECTION", "TEAM"];

/** Edit form for one framework. Validation failures come back as text, not as a page error. */
function EditRow({
  node,
  parentOptions,
  onDone,
}: {
  node: HierarchyNode;
  parentOptions: ParentOption[];
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<OrgEditState, FormData>(updateOrgNode, {});

  useEffect(() => {
    if (state.savedAt) onDone(); // close only when the server accepted the change
  }, [state.savedAt, onDone]);

  return (
    <div>
      <form action={formAction} className="flex flex-wrap items-center gap-2 rounded-md bg-brand-50/60 px-2 py-2">
        <input type="hidden" name="id" value={node.id} />
        <input name="name" defaultValue={node.name} required className={`${inputCls} w-48`} aria-label="שם המסגרת" />
        <select name="kind" defaultValue={node.kind} className={inputCls} aria-label="סוג המסגרת">
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
        <select name="parentId" defaultValue={node.parentId ?? ""} className={inputCls} aria-label="מסגרת אב">
          <option value="">— ללא (מרכז שורש)</option>
          {parentOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          disabled={pending}
          className="rounded-md bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "שומר…" : "שמור"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-border px-3 py-1 text-xs hover:bg-stone-50"
        >
          ביטול
        </button>
      </form>
      {state.error && (
        <p className="mt-1 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-800">{state.error}</p>
      )}
    </div>
  );
}

function ViewRow({
  node,
  total,
  onEdit,
  onDelete,
}: {
  node: HierarchyNode;
  total: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-stone-50">
      <span className="flex items-center gap-2">
        <span className="text-xs text-muted">{KIND_LABEL[node.kind]}</span>
        <span className="font-medium">{node.name}</span>
        <span className="text-xs text-muted">{`· ${plural(total, "איש", "אנשים")}`}</span>
        {node.commander && (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">מפקד: {node.commander}</span>
        )}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          title="ערוך מסגרת"
          className="rounded p-1 text-muted hover:bg-brand-50 hover:text-brand-700"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onDelete}
          title="מחק מסגרת"
          className="rounded p-1 text-muted hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

export function HierarchyTree({ nodes }: { nodes: HierarchyNode[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<HierarchyNode | null>(null);

  const { byParent, descendantsOf } = useMemo(() => {
    const map = new Map<string | null, HierarchyNode[]>();
    for (const n of nodes) {
      const arr = map.get(n.parentId) ?? [];
      arr.push(n);
      map.set(n.parentId, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.name.localeCompare(b.name, "he"));

    const walk = (id: string): HierarchyNode[] => {
      const out: HierarchyNode[] = [];
      for (const c of map.get(id) ?? []) {
        out.push(c, ...walk(c.id));
      }
      return out;
    };
    return { byParent: map, descendantsOf: walk };
  }, [nodes]);

  const subtreePeople = (node: HierarchyNode) =>
    node.direct + descendantsOf(node.id).reduce((s, n) => s + n.direct, 0);

  /** A node may move anywhere except into itself or its own subtree. */
  const parentOptionsFor = (node: HierarchyNode): ParentOption[] => {
    const blocked = new Set([node.id, ...descendantsOf(node.id).map((n) => n.id)]);
    return nodes
      .filter((n) => !blocked.has(n.id))
      .map((n) => ({ id: n.id, label: `${KIND_LABEL[n.kind]}: ${n.name}` }))
      .sort((a, b) => a.label.localeCompare(b.label, "he"));
  };

  const renderNode = (node: HierarchyNode, depth: number) => (
    <div key={node.id}>
      <div style={{ paddingInlineStart: `${depth * 20 + 8}px` }}>
        {editing === node.id ? (
          <EditRow node={node} parentOptions={parentOptionsFor(node)} onDone={() => setEditing(null)} />
        ) : (
          <ViewRow
            node={node}
            total={subtreePeople(node)}
            onEdit={() => setEditing(node.id)}
            onDelete={() => setPendingDelete(node)}
          />
        )}
      </div>
      {(byParent.get(node.id) ?? []).map((c) => renderNode(c, depth + 1))}
    </div>
  );

  const roots = byParent.get(null) ?? [];

  // delete-confirmation facts, computed from the same tree the user is looking at
  const doomed = pendingDelete ? descendantsOf(pendingDelete.id) : [];
  const doomedPeople = pendingDelete ? subtreePeople(pendingDelete) : 0;

  return (
    <>
      <div className="rounded-xl border border-border/70 bg-card p-2 shadow-sm">
        {roots.length === 0 ? (
          <p className="px-2 py-2 text-sm text-muted">אין מסגרות עדיין. התחל ביצירת מרכז.</p>
        ) : (
          roots.map((r) => renderNode(r, 0))
        )}
      </div>

      {pendingDelete && (
        <ConfirmDelete
          title={`מחיקת ${KIND_LABEL[pendingDelete.kind]} ״${pendingDelete.name}״`}
          confirmLabel={doomed.length > 0 ? "מחק את המסגרת ואת כל שתחתיה" : "מחק את המסגרת"}
          onCancel={() => setPendingDelete(null)}
          action={removeOrgNode}
          hidden={{ id: pendingDelete.id }}
        >
          {doomed.length > 0 ? (
            <>
              <p className="text-red-800">
                המחיקה תמחק גם את <b>{doomed.length === 1 ? "תת-המסגרת" : `${doomed.length} תתי-המסגרות`}</b> שתחתיה:
              </p>
              <ul className="max-h-40 space-y-0.5 overflow-y-auto rounded-md bg-red-50 px-3 py-2 text-red-900">
                {doomed.map((d) => (
                  <li key={d.id}>
                    {KIND_LABEL[d.kind]}: {d.name}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-muted">אין תת-מסגרות תחת המסגרת הזו.</p>
          )}
          {doomedPeople > 0 && (
            <p className="text-amber-800">
              {plural(doomedPeople, "איש", "אנשים")} שמשויכים למסגרות אלו יעברו ל״ללא שיוך״ — הכרטיסים והתכניות שלהם
              יישמרו.
            </p>
          )}
        </ConfirmDelete>
      )}
    </>
  );
}
