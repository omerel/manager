import { KIND_LABEL, type OrgTreeNode } from "@/lib/org";
import type { AccessLevel } from "@/generated/prisma/client";

export function LevelBadge({ level }: { level: AccessLevel | null }) {
  if (!level) return null;
  const isEdit = level === "EDIT";
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-xs ${
        isEdit ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
      }`}
    >
      {isEdit ? "עריכה" : "צפייה"}
    </span>
  );
}

function TreeRow({ node, depth }: { node: OrgTreeNode; depth: number }) {
  return (
    <div>
      <div
        className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50"
        style={{ paddingInlineStart: `${depth * 20 + 8}px` }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">{KIND_LABEL[node.kind]}</span>
          <span className="font-medium">{node.name}</span>
          <LevelBadge level={node.level} />
        </div>
        <span className="text-sm text-muted">
          {node.totalPeople} {node.totalPeople === 1 ? "איש" : "אנשים"}
        </span>
      </div>
      {node.children.map((c) => (
        <TreeRow key={c.id} node={c} depth={depth + 1} />
      ))}
    </div>
  );
}

export function OrgTree({ roots }: { roots: OrgTreeNode[] }) {
  if (roots.length === 0) {
    return <p className="text-muted">אין מסגרות בהרשאה שלך.</p>;
  }
  return (
    <div className="rounded-xl border border-border/70 bg-card shadow-sm p-2">
      {roots.map((r) => (
        <TreeRow key={r.id} node={r} depth={0} />
      ))}
    </div>
  );
}
