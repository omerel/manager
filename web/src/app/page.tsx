import Link from "next/link";
import { AlertTriangle, Clock, Users } from "lucide-react";
import { computeVisibility } from "@/lib/access";
import { getSessionUser } from "@/lib/session";
import {
  buildGapTree,
  parseGapKind,
  findNode,
  flattenWithPaths,
  attentionList,
  narrowTree,
  GAP_KIND_LABEL,
  UNASSIGNED_NODE_ID,
} from "@/lib/gap-dashboard";
import { GapDashboard } from "@/components/GapDashboard";
import { DashboardFilters } from "@/components/DashboardFilters";
import { GAP_META } from "@/lib/gaps";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ node?: string; kind?: string }> }) {
  const { node: rawNode, kind: rawKind } = await searchParams;
  const user = await getSessionUser();
  const visibility = await computeVisibility(user);
  const today = new Date();
  const allRoots = await buildGapTree(visibility, today);
  const kind = parseGapKind(rawKind);

  // The chosen framework is looked up INSIDE the forest the viewer can see, so
  // a link naming something outside their visibility simply finds nothing —
  // a shared link can never widen what its recipient sees.
  const chosen = rawNode ? findNode(allRoots, rawNode) : null;
  const lostFramework = !!rawNode && !chosen;

  // Narrowing by framework means re-rooting the forest, not rebuilding it: the
  // rollups are already correct at every node, and a second computation with a
  // narrower scope would be a second thing to keep in step with the first.
  const roots = chosen ? [chosen] : allRoots;

  const total = roots.reduce((s, r) => s + r.total, 0);
  // within the current narrowing: narrowing to a subtree without the node yields 0
  const unassignedCount = roots.reduce((s, r) => s + (findNode([r], UNASSIGNED_NODE_ID)?.total ?? 0), 0);
  const red = roots.reduce((s, r) => s + r.red, 0);
  const overdueEvents = roots.reduce((s, r) => s + r.overdueEvents, 0);
  const approachingEvents = roots.reduce((s, r) => s + r.approachingEvents, 0);
  // Deliberately NOT a function of `kind`. If you are here to "fix" that: a
  // gauge that changed meaning with a filter would make one number on one
  // screen mean two different things depending on a control easily forgotten.
  const compliance = total > 0 ? 100 - Math.round((red / total) * 100) : 100;

  // per-framework comparison: the highest visible level with siblings (fall back to roots)
  const compareNodes = roots.length > 1 ? roots : roots[0]?.children?.length ? roots[0].children : roots;
  const noChildren = !!chosen && chosen.children.length === 0;

  // needs-attention: the people in gap state, narrowed by the chosen kind
  const attention = roots.flatMap((r) => attentionList(r, kind));
  const treeRoots = narrowTree(roots, kind);
  const frameworks = flattenWithPaths(allRoots);

  const dateStr = new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long" }).format(today);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">שלום, {user.name} 👋</h1>
          <p className="mt-1 text-muted">
            {user.role === "ADMIN" ? "תמונת מצב של כל העץ הארגוני." : "תמונת מצב של המסגרות שבאחריותך."}
          </p>
        </div>
        <span className="text-sm text-muted">{dateStr}</span>
      </div>

      <DashboardFilters frameworks={frameworks} node={chosen?.id ?? ""} kind={kind} />

      {lostFramework && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900">
          המסגרת שנבחרה אינה זמינה עוד — ייתכן שנמחקה או שאינה בראותך. מוצג ההיקף המלא שלך.
        </p>
      )}

      {/* stat row: gauge + tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="flex items-center justify-center rounded-xl border border-border/70 bg-card p-4 shadow-sm">
          <RingGauge value={compliance} label="עמידה ביחס לפקודים" />
        </div>
        <StatTile
          icon={<AlertTriangle className="h-5 w-5" aria-hidden />}
          value={overdueEvents}
          label="אירועים באי-עמידה"
          tone={overdueEvents > 0 ? "red" : "green"}
        />
        <StatTile
          icon={<Clock className="h-5 w-5" aria-hidden />}
          value={approachingEvents}
          label="אירועים מתקרבים"
          tone={approachingEvents > 0 ? "amber" : "green"}
        />
        <StatTile
          icon={<Users className="h-5 w-5" aria-hidden />}
          value={total}
          label="אנשים תחת ניהולי"
          sub={unassignedCount > 0 ? `(מתוכם ${unassignedCount} ללא שיוך)` : undefined}
          tone="mint"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* per-framework compliance bars */}
        <section className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-brand-900">עמידה לפי מסגרת</h2>
          {noChildren ? (
            <p className="text-sm text-muted">
              ל{chosen!.name} אין תת-מסגרות, ולכן אין מה להשוות. המספרים למעלה הם של המסגרת עצמה.
            </p>
          ) : compareNodes.length === 0 ? (
            <p className="text-sm text-muted">אין מסגרות בראות שלך.</p>
          ) : (
            <ul className="space-y-3">
              {compareNodes.map((n) => {
                const pct = n.total > 0 ? 100 - Math.round((n.red / n.total) * 100) : 100;
                return (
                  <li key={n.id}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium">{n.name}</span>
                      <span className={pct === 100 ? "text-brand-700" : pct >= 70 ? "text-amber-600" : "text-red-600"}>
                        {pct}%
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-stone-100">
                      <div
                        className={`h-full rounded-full ${pct === 100 ? "bg-brand-500" : pct >= 70 ? "bg-amber-400" : "bg-red-400"}`}
                        style={{ width: `${Math.max(pct, 4)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* needs attention */}
        <section className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-brand-900">
            <AlertTriangle className="h-4 w-4 text-red-500" aria-hidden />
            דורשים תשומת-לב
            <span className="text-xs font-normal text-muted">· {GAP_KIND_LABEL[kind]}</span>
          </h2>
          {attention.length === 0 ? (
            <div className="rounded-lg bg-brand-50 px-4 py-6 text-center text-sm text-brand-800">
              {kind === "approaching"
                ? "🎉 אף אחד אינו מתקרב לתאריך יעד."
                : kind === "overdue"
                  ? "🎉 אין אף אחד בפיגור — כל הפקודים עומדים בתכנית."
                  : "🎉 אין אף אחד בפיגור או מתקרב — כל הפקודים עומדים בתכנית."}
            </div>
          ) : (
            <ul className="divide-y divide-border/70">
              {attention.slice(0, 6).map((p) => (
                <li key={p.id}>
                  <Link href={`/people/${p.id}`} className="flex items-center justify-between gap-2 py-2.5 hover:bg-stone-50">
                    <span className="flex items-center gap-2">
                      <span className={`inline-block h-2.5 w-2.5 rounded-full ${GAP_META[p.status].dot}`} />
                      <span className="font-medium">{p.name}</span>
                      <span className="text-xs text-muted">{GAP_META[p.status].label}</span>
                      <span className="text-xs text-muted">{p.path}</span>
                    </span>
                    <span className="text-xs text-brand-700">לכרטיס ←</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* collapsible org tree */}
      <details className="group rounded-xl border border-border/70 bg-card shadow-sm" open>
        <summary className="cursor-pointer select-none px-5 py-3.5 font-semibold text-brand-900 hover:bg-stone-50">
          עץ ארגוני מלא · פערים מתגלגלים
        </summary>
        <div className="border-t border-border/70 p-3">
          <GapDashboard roots={treeRoots} />
          <p className="mt-2 px-2 text-xs text-muted">
            המספרים מתגלגלים בעץ ואינם מושפעים מבורר סוג האירוע. לחיצה על שם פותחת את כרטיס העובד.
            {kind !== "all" && ` רשימות האנשים מצומצמות ל${GAP_KIND_LABEL[kind]}.`}
          </p>
        </div>
      </details>
    </div>
  );
}

/* ---- visual bits ---- */

function RingGauge({ value, label }: { value: number; label: string }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const filled = (value / 100) * c;
  const color = value >= 90 ? "#059669" : value >= 70 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-3">
      <svg width="88" height="88" viewBox="0 0 88 88" aria-label={`${label}: ${value}%`}>
        <circle cx="44" cy="44" r={r} fill="none" stroke="#e7e5e4" strokeWidth="9" />
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c - filled}`}
          transform="rotate(-90 44 44)"
        />
        <text x="44" y="49" textAnchor="middle" fontSize="19" fontWeight="700" fill={color}>
          {value}%
        </text>
      </svg>
      <span className="max-w-[90px] text-sm font-medium text-muted">{label}</span>
    </div>
  );
}

function StatTile({
  icon,
  value,
  label,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  /** small parenthetical line under the label, e.g. the unassigned count */
  sub?: string;
  tone: "red" | "amber" | "green" | "mint";
}) {
  const tones = {
    red: "bg-red-50 text-red-600",
    amber: "bg-amber-50 text-amber-600",
    green: "bg-brand-50 text-brand-600",
    mint: "bg-brand-50 text-brand-700",
  } as const;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tones[tone]}`}>{icon}</span>
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-sm text-muted">{label}</div>
        {sub && <div className="text-xs text-muted">{sub}</div>}
      </div>
    </div>
  );
}
