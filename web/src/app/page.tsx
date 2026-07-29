import { computeVisibility } from "@/lib/access";
import { getSessionUser } from "@/lib/session";
import { buildGapTree } from "@/lib/gap-dashboard";
import { GapDashboard } from "@/components/GapDashboard";
import { APPROACHING_DAYS } from "@/lib/gaps";

export default async function DashboardPage() {
  const user = await getSessionUser();
  const visibility = await computeVisibility(user);
  const today = new Date();
  const roots = await buildGapTree(visibility, today);

  const total = roots.reduce((s, r) => s + r.total, 0);
  const red = roots.reduce((s, r) => s + r.red, 0); // people with a gap (overdue)
  const overdueEvents = roots.reduce((s, r) => s + r.overdueEvents, 0);
  const approachingEvents = roots.reduce((s, r) => s + r.approachingEvents, 0);
  // עמידה = 100% פחות אחוז האנשים שיש להם פער, בתוך המסגרת של המנהל
  const compliance = total > 0 ? 100 - Math.round((red / total) * 100) : 100;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">דשבורד פערים</h1>
        <p className="mt-1 text-muted">
          {user.role === "ADMIN"
            ? "כאדמין את/ה רואה את כל העץ הארגוני."
            : "התצוגה חתוכה אוטומטית למסגרות שהוענקו לך (איחוד תת-העצים)."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="אנשים תחת ניהולי" value={total} />
        <Stat label="אי עמידה בתכנית קריירה" value={`${overdueEvents} אירועים`} tone={overdueEvents > 0 ? "red" : undefined} />
        <Stat label="אירועים מתקרבים" value={`${approachingEvents} אירועים`} tone={approachingEvents > 0 ? "amber" : undefined} />
        <Stat label="עמידה ביחס לפקודים" value={`${compliance}%`} tone={compliance < 100 ? "red" : undefined} />
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">עץ ארגוני · פערים מתגלגלים</h2>
        <GapDashboard roots={roots} />
        <p className="text-xs text-muted">
          המספרים מתגלגלים בעץ. פער נגזר מהיום ({APPROACHING_DAYS} יום = חלון "מתקרב"), התכנית וההתקדמות. לחיצה על שם פותחת את כרטיס העובד.
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: "red" | "amber" }) {
  const toneCls = tone === "red" ? "text-red-700" : tone === "amber" ? "text-amber-700" : "";
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className={`text-2xl font-bold ${toneCls}`}>{value}</div>
      <div className="text-sm text-muted">{label}</div>
    </div>
  );
}
