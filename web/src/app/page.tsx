import Link from "next/link";
import { AlertTriangle, Clock, Users } from "lucide-react";
import { computeVisibility } from "@/lib/access";
import { getSessionUser } from "@/lib/session";
import { buildGapTree, type GapTreeNode } from "@/lib/gap-dashboard";
import { GapDashboard } from "@/components/GapDashboard";
import { GAP_META } from "@/lib/gaps";

export default async function DashboardPage() {
  const user = await getSessionUser();
  const visibility = await computeVisibility(user);
  const today = new Date();
  const roots = await buildGapTree(visibility, today);

  const total = roots.reduce((s, r) => s + r.total, 0);
  const red = roots.reduce((s, r) => s + r.red, 0);
  const overdueEvents = roots.reduce((s, r) => s + r.overdueEvents, 0);
  const approachingEvents = roots.reduce((s, r) => s + r.approachingEvents, 0);
  const compliance = total > 0 ? 100 - Math.round((red / total) * 100) : 100;

  // per-framework comparison: the highest visible level with siblings (fall back to roots)
  const compareNodes = roots.length > 1 ? roots : roots[0]?.children?.length ? roots[0].children : roots;

  // needs-attention: all people in OVERDUE state across the scoped tree
  const attention: { id: string; name: string; path: string }[] = [];
  const walk = (n: GapTreeNode, path: string[]) => {
    for (const p of n.people) {
      if (p.status === "OVERDUE") attention.push({ id: p.id, name: p.name, path: [...path, n.name].join(" ▸ ") });
    }
    for (const c of n.children) walk(c, [...path, n.name]);
  };
  for (const r of roots) walk(r, []);

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
        <StatTile icon={<Users className="h-5 w-5" aria-hidden />} value={total} label="אנשים תחת ניהולי" tone="mint" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* per-framework compliance bars */}
        <section className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-brand-900">עמידה לפי מסגרת</h2>
          {compareNodes.length === 0 ? (
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
          </h2>
          {attention.length === 0 ? (
            <div className="rounded-lg bg-brand-50 px-4 py-6 text-center text-sm text-brand-800">
              🎉 אין אף אחד בפיגור — כל הפקודים עומדים בתכנית.
            </div>
          ) : (
            <ul className="divide-y divide-border/70">
              {attention.slice(0, 6).map((p) => (
                <li key={p.id}>
                  <Link href={`/people/${p.id}`} className="flex items-center justify-between gap-2 py-2.5 hover:bg-stone-50">
                    <span className="flex items-center gap-2">
                      <span className={`inline-block h-2.5 w-2.5 rounded-full ${GAP_META.OVERDUE.dot}`} />
                      <span className="font-medium">{p.name}</span>
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
          <GapDashboard roots={roots} />
          <p className="mt-2 px-2 text-xs text-muted">
            המספרים מתגלגלים בעץ. לחיצה על שם פותחת את כרטיס העובד.
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
  tone,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
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
      </div>
    </div>
  );
}
