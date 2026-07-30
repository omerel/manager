"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, Minimize2, Maximize2 } from "lucide-react";
import { KIND_LABEL } from "@/lib/org-kinds";
import { GAP_META, type GapLevel } from "@/lib/gap-meta";
import type { GapTreeNode } from "@/lib/gap-dashboard";

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
      className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-stone-50"
      style={{ paddingInlineStart: "12px" }}
    >
      <span className={`inline-block h-2 w-2 rounded-full ${meta ? meta.dot : "bg-stone-200"}`} />
      <span className="text-brand-700 hover:underline">{name}</span>
      <span className="text-xs text-muted">{status ? meta!.label : "אין תכנית"}</span>
    </Link>
  );
}

function Node({
  node,
  depth,
  collapsed,
  toggle,
}: {
  node: GapTreeNode;
  depth: number;
  collapsed: Set<string>;
  toggle: (id: string) => void;
}) {
  const hasContents = node.children.length > 0 || node.people.length > 0;
  const isCollapsed = collapsed.has(node.id);

  return (
    <div>
      <div
        className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-stone-50"
        style={{ paddingInlineStart: `${depth * 20 + 8}px` }}
      >
        <span className="flex items-center gap-1.5">
          {hasContents ? (
            <button
              type="button"
              onClick={() => toggle(node.id)}
              className="rounded p-0.5 text-muted hover:bg-stone-100 hover:text-foreground"
              title={isCollapsed ? "הרחב" : "כווץ"}
              aria-expanded={!isCollapsed}
            >
              {isCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          ) : (
            <span className="inline-block w-5" />
          )}
          <span className="text-xs text-muted">{KIND_LABEL[node.kind]}</span>
          <span className="font-medium">{node.name}</span>
        </span>
        <Counts node={node} />
      </div>

      {!isCollapsed && (
        <>
          {/* drill-down: people at the team level */}
          {node.people.length > 0 && (
            <div style={{ paddingInlineStart: `${(depth + 1) * 20 + 8}px` }}>
              {node.people.map((p) => (
                <PersonRow key={p.id} id={p.id} name={p.name} status={p.status} />
              ))}
            </div>
          )}
          {node.children.map((c) => (
            <Node key={c.id} node={c} depth={depth + 1} collapsed={collapsed} toggle={toggle} />
          ))}
        </>
      )}
    </div>
  );
}

export function GapDashboard({ roots }: { roots: GapTreeNode[] }) {
  // team ids — the "collapse all teams" target (teams are where the people hang)
  const teamIds = useMemo(() => {
    const ids: string[] = [];
    const walk = (n: GapTreeNode) => {
      if (n.kind === "TEAM") ids.push(n.id);
      n.children.forEach(walk);
    };
    roots.forEach(walk);
    return ids;
  }, [roots]);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const teamsCollapsed = teamIds.length > 0 && teamIds.every((id) => collapsed.has(id));

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAllTeams = () =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      for (const id of teamIds) {
        if (teamsCollapsed) next.delete(id);
        else next.add(id);
      }
      return next;
    });

  if (roots.length === 0) return <p className="text-muted">אין מסגרות בהרשאה שלך.</p>;

  return (
    <div className="rounded-xl border border-border/70 bg-card p-2 shadow-sm">
      {teamIds.length > 0 && (
        <div className="mb-1 flex justify-end border-b border-border/70 px-2 pb-2">
          <button
            type="button"
            onClick={toggleAllTeams}
            className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-stone-50"
          >
            {teamsCollapsed ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
            {teamsCollapsed ? "הרחב את כל הצוותים" : "כווץ את כל הצוותים"}
          </button>
        </div>
      )}
      {roots.map((r) => (
        <Node key={r.id} node={r} depth={0} collapsed={collapsed} toggle={toggle} />
      ))}
    </div>
  );
}
