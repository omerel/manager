import Link from "next/link";
import { KIND_LABEL } from "@/lib/org";
import { GAP_META, type GapLevel } from "@/lib/gaps";
import type { GapTreeNode } from "@/lib/gap-dashboard";
import { LevelBadge } from "@/components/OrgTree";

function Counts({ node }: { node: GapTreeNode }) {
  return (
    <span className="flex items-center gap-2 text-sm">
      {node.red > 0 && <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-700">🔴 {node.red}</span>}
      {node.yellow > 0 && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">🟡 {node.yellow}</span>}
      <span className="text-muted">
        {node.total} {node.total === 1 ? "איש" : "אנשים"}
      </span>
    </span>
  );
}

function PersonRow({ id, name, status }: { id: string; name: string; status: GapLevel | null }) {
  const meta = status ? GAP_META[status] : null;
  return (
    <Link
      href={`/people/${id}`}
      className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50"
      style={{ paddingInlineStart: "12px" }}
    >
      <span className={`inline-block h-2 w-2 rounded-full ${meta ? meta.dot : "bg-slate-200"}`} />
      <span className="text-blue-700 hover:underline">{name}</span>
      <span className="text-xs text-muted">{status ? meta!.label : "אין תכנית"}</span>
    </Link>
  );
}

function Node({ node, depth }: { node: GapTreeNode; depth: number }) {
  return (
    <div>
      <div
        className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50"
        style={{ paddingInlineStart: `${depth * 20 + 8}px` }}
      >
        <span className="flex items-center gap-2">
          <span className="text-xs text-muted">{KIND_LABEL[node.kind]}</span>
          <span className="font-medium">{node.name}</span>
          <LevelBadge level={node.level} />
        </span>
        <Counts node={node} />
      </div>
      {/* drill-down: people at the team level */}
      {node.people.length > 0 && (
        <div style={{ paddingInlineStart: `${(depth + 1) * 20 + 8}px` }}>
          {node.people.map((p) => (
            <PersonRow key={p.id} id={p.id} name={p.name} status={p.status} />
          ))}
        </div>
      )}
      {node.children.map((c) => (
        <Node key={c.id} node={c} depth={depth + 1} />
      ))}
    </div>
  );
}

export function GapDashboard({ roots }: { roots: GapTreeNode[] }) {
  if (roots.length === 0) return <p className="text-muted">אין מסגרות בהרשאה שלך.</p>;
  return (
    <div className="rounded-lg border border-border bg-card p-2">
      {roots.map((r) => (
        <Node key={r.id} node={r} depth={0} />
      ))}
    </div>
  );
}
