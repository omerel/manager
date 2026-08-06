"use client";

import { useRouter } from "next/navigation";
import { Filter, X } from "lucide-react";
import { KIND_LABEL } from "@/lib/org-kinds";
import type { OrgKindStr } from "@/lib/org-kinds";
import type { GapKind } from "@/lib/gap-dashboard";

export type FrameworkOption = { id: string; path: string; kind: OrgKindStr };

/**
 * The dashboard's two narrowings.
 *
 * Both go into the ADDRESS rather than into local state, so a reload keeps
 * them, the back button steps through them, and the view can be sent to
 * somebody else — who will see it inside their own visibility, never wider.
 */
export function DashboardFilters({
  frameworks,
  node,
  kind,
}: {
  frameworks: FrameworkOption[];
  node: string;
  kind: GapKind;
}) {
  const router = useRouter();

  const go = (next: { node?: string; kind?: string }) => {
    const params = new URLSearchParams();
    const n = next.node ?? node;
    const k = next.kind ?? kind;
    if (n) params.set("node", n);
    if (k && k !== "all") params.set("kind", k);
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/");
  };

  const active = !!node || kind !== "all";

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border/70 bg-card px-4 py-3 shadow-sm">
      <span className="flex items-center gap-1.5 pb-1.5 text-sm text-muted">
        <Filter className="h-4 w-4" aria-hidden />
        הצג
      </span>

      <div className="flex flex-col">
        <label htmlFor="node" className="mb-1 text-xs text-muted">
          מסגרת
        </label>
        <select
          id="node"
          value={node}
          onChange={(e) => go({ node: e.target.value })}
          className="rounded-md border border-border px-3 py-1.5 text-sm"
        >
          <option value="">כל המסגרות שבראותי</option>
          {frameworks.map((f) => (
            <option key={f.id} value={f.id}>
              {KIND_LABEL[f.kind]}: {f.path}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col">
        <label htmlFor="kind" className="mb-1 text-xs text-muted">
          סוג אירוע
        </label>
        <select
          id="kind"
          value={kind}
          onChange={(e) => go({ kind: e.target.value })}
          className="rounded-md border border-border px-3 py-1.5 text-sm"
        >
          <option value="all">הכל</option>
          <option value="approaching">מתקרב</option>
          <option value="overdue">אי-עמידה</option>
        </select>
      </div>

      {active && (
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex items-center gap-1 pb-1.5 text-sm text-muted hover:underline"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          נקה
        </button>
      )}

      {/* The gauge deliberately ignores the kind, so the page says which figure
          moves with the filter and which does not, rather than leaving it to be
          discovered by someone comparing two screenshots. */}
      <p className="w-full text-xs text-muted">
        בורר המסגרת מצמצם את כל המספרים. בורר סוג האירוע מצמצם רשימות אנשים בלבד — מדד העמידה ופסי ההשוואה מודדים
        אי-עמידה תמיד.
      </p>
    </div>
  );
}
