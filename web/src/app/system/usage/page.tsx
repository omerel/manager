import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/authz";
import { Activity, FileDown, FileSpreadsheet, LogIn, Moon, PenLine, Users } from "lucide-react";
import { availableWindows, defaultWindow, usageStats, type UsageStats } from "@/lib/usage-stats";

/**
 * How the system is being used, for the Admin.
 *
 * It counts sign-ins and the write trail — the only things this system records.
 * Reading leaves no trace anywhere, so the page says what it counts rather than
 * letting a quiet row be read as an absent person.
 */
export default async function UsagePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; user?: string }>;
}) {
  if (!(await isAdmin())) redirect("/");
  const { days: rawDays, user: rawUser } = await searchParams;

  const windows = availableWindows();
  const asked = Number(rawDays);
  const days = windows.includes(asked) ? asked : defaultWindow();
  const stats = await usageStats({ days, userId: rawUser || null });

  const qs = (over: { days?: number; user?: string }) => {
    const p = new URLSearchParams();
    p.set("days", String(over.days ?? days));
    const u = over.user !== undefined ? over.user : (rawUser ?? "");
    if (u) p.set("user", u);
    return `?${p}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">דשבורד פעילות</h1>
          <p className="mt-1 text-muted">
            שימוש המשתמשים במערכת — אדמין בלבד.{" "}
            <span className="text-xs">
              נספרות כניסות ופעולות שנרשמו (יצירה, עריכה, מחיקה, ייצוא). צפייה בלבד אינה נרשמת בשום מקום במערכת,
              ולכן מי שקורא הרבה ומשנה מעט ייראה כאן שקט.
            </span>
          </p>
        </div>
        <Link href="/system/activity" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-stone-50">
          יומן פעילות
        </Link>
      </div>

      {/* window · user · exports */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">חלון:</span>
          {windows.map((w) => (
            <Link
              key={w}
              href={qs({ days: w })}
              className={`rounded-md border px-3 py-1 text-sm ${
                w === days ? "border-brand-600 bg-brand-50 font-medium text-brand-800" : "border-border hover:bg-stone-50"
              }`}
            >
              {w} ימים
            </Link>
          ))}
          <span className="text-xs text-muted">
            {stats.retention === 0
              ? "· היומן נשמר ללא הגבלת זמן"
              : `· היומן נשמר ל-${stats.retention} ימים, ולכן אין חלון ארוך מזה`}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {stats.focus && (
            <Link href={qs({ user: "" })} className="rounded-md border border-border px-3 py-1 text-sm hover:bg-stone-50">
              ← כל המשתמשים
            </Link>
          )}
          <a
            href={`/system/usage/export?format=pdf&days=${days}${rawUser ? `&user=${rawUser}` : ""}`}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1 text-sm hover:bg-stone-50"
          >
            <FileDown className="h-4 w-4 text-brand-600" aria-hidden /> PDF
          </a>
          <a
            href={`/system/usage/export?format=xlsx&days=${days}${rawUser ? `&user=${rawUser}` : ""}`}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1 text-sm hover:bg-stone-50"
          >
            <FileSpreadsheet className="h-4 w-4 text-brand-600" aria-hidden /> אקסל
          </a>
        </div>
      </div>

      {stats.focus && (
        <p className="rounded-lg bg-brand-50 px-4 py-2 text-sm text-brand-900">
          מוצגת פעילותו של <b>{stats.focus.name}</b> בלבד.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile icon={<Users className="h-5 w-5" aria-hidden />} value={`${stats.activeUsers}/${stats.totalUsers}`} label="משתמשים פעילים" tone="mint" />
        <Tile icon={<LogIn className="h-5 w-5" aria-hidden />} value={stats.logins} label="כניסות" tone="green" />
        <Tile icon={<PenLine className="h-5 w-5" aria-hidden />} value={stats.actions} label="פעולות" tone="green" />
        <Tile icon={<Moon className="h-5 w-5" aria-hidden />} value={stats.dormant} label="רדומים (30 יום ללא כניסה)" tone={stats.dormant > 0 ? "amber" : "mint"} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-brand-900">
            <Activity className="h-4 w-4 text-brand-600" aria-hidden />
            פעילות לאורך זמן
          </h2>
          <DailyBars daily={stats.daily} />
        </section>

        <section className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-brand-900">פילוח לפי סוג פעולה</h2>
          {stats.families.length === 0 ? (
            <p className="text-sm text-muted">אין פעילות בחלון הזה.</p>
          ) : (
            <ul className="space-y-2">
              {stats.families.map((f) => {
                const pct = Math.round((f.count / stats.families[0].count) * 100);
                return (
                  <li key={f.family}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>{f.label}</span>
                      <span className="text-muted">{f.count}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-stone-100">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(pct, 3)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-border/70 bg-card shadow-sm">
        <h2 className="border-b border-border/70 px-5 py-3.5 font-semibold text-brand-900">לפי משתמש</h2>
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-start text-sm">
            <thead className="sticky top-0 z-10 bg-stone-50 text-muted shadow-[0_1px_0_var(--color-border)]">
              <tr>
                <Th>משתמש</Th>
                <Th>תפקיד</Th>
                <Th>כניסות</Th>
                <Th>פעולות</Th>
                <Th>פעילות אחרונה</Th>
                <Th>מגמה</Th>
              </tr>
            </thead>
            <tbody>
              {stats.users.map((u) => (
                <tr key={u.userId} className="border-t border-border hover:bg-stone-50">
                  <td className="px-4 py-2.5">
                    <Link href={qs({ user: u.userId })} className="font-medium text-brand-800 hover:underline">
                      {u.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-muted">{ROLE_LABEL[u.role] ?? u.role}</td>
                  <td className="px-4 py-2.5">{u.logins}</td>
                  <td className="px-4 py-2.5">{u.actions}</td>
                  <td className="px-4 py-2.5 text-muted">{lastLabel(u.lastActivity, u.lastLoginAt)}</td>
                  <td className="px-4 py-2.5"><Sparkline series={u.series} /></td>
                </tr>
              ))}
              {stats.users.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">אין משתמשים להצגה.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const ROLE_LABEL: Record<string, string> = { ADMIN: "אדמין", MANAGER: "מפקד", HR: "משא״ן" };

/** «היום» / «לפני 3 ימים» / «מעולם» — a distance, which is what the eye wants here. */
function lastLabel(lastActivity: Date | null, lastLogin: Date | null): string {
  const d = lastActivity ?? lastLogin;
  if (!d) return "מעולם";
  const days = Math.floor((Date.now() - d.getTime()) / 86400_000);
  if (days <= 0) return "היום";
  if (days === 1) return "אתמול";
  return `לפני ${days} ימים`;
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2 text-start font-medium">{children}</th>;
}

function Tile({
  icon, value, label, tone,
}: { icon: React.ReactNode; value: number | string; label: string; tone: "green" | "amber" | "mint" }) {
  const tones = { green: "bg-brand-50 text-brand-600", amber: "bg-amber-50 text-amber-600", mint: "bg-brand-50 text-brand-700" } as const;
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

/** One bar per day. Logins stack under actions, so the eye reads both at once. */
function DailyBars({ daily }: { daily: UsageStats["daily"] }) {
  const max = Math.max(1, ...daily.map((d) => d.logins + d.actions));
  return (
    <div>
      <div className="flex h-40 items-end gap-[2px]">
        {daily.map((d) => {
          const total = d.logins + d.actions;
          return (
            <div
              key={d.day}
              // h-full is load-bearing: the inner bars are sized in PERCENT,
              // and a percentage height resolves against a parent with a
              // definite one. Without it the column is auto-height and every
              // bar computes to zero — a chart that renders empty.
              className="flex h-full flex-1 flex-col justify-end"
              title={`${d.day} · ${d.logins} כניסות · ${d.actions} פעולות`}
            >
              <div className="w-full rounded-t bg-brand-500" style={{ height: `${(d.actions / max) * 100}%` }} />
              <div className="w-full bg-brand-800" style={{ height: `${(d.logins / max) * 100}%` }} />
              {total === 0 && <div className="h-[2px] w-full bg-stone-200" />}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted">
        <span>{daily[0]?.day}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1"><i className="inline-block h-2 w-3 rounded-sm bg-brand-800" /> כניסות</span>
          <span className="flex items-center gap-1"><i className="inline-block h-2 w-3 rounded-sm bg-brand-500" /> פעולות</span>
        </span>
        <span>{daily[daily.length - 1]?.day}</span>
      </div>
    </div>
  );
}

/** A user's window, small enough to sit in a table cell. */
function Sparkline({ series }: { series: number[] }) {
  const max = Math.max(1, ...series);
  const w = 72;
  const h = 20;
  const step = series.length > 1 ? w / (series.length - 1) : w;
  const pts = series.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * (h - 2)).toFixed(1)}`).join(" ");
  const flat = series.every((v) => v === 0);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="overflow-visible">
      <polyline points={pts} fill="none" stroke={flat ? "#d6d3d1" : "#059669"} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
