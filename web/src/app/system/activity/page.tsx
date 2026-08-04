import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/authz";
import { readActivity, activityFacets } from "@/lib/activity-log";

/**
 * What users did, for the Admin to investigate with.
 *
 * The guard here is presentation; `readActivity` calls requireAdmin itself,
 * which is what actually protects the data.
 */
const PAGE_SIZE = 200;

const dt = new Intl.DateTimeFormat("he-IL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ actor?: string; action?: string }>;
}) {
  if (!(await isAdmin())) redirect("/");
  const { actor, action } = await searchParams;

  const [rows, facets] = await Promise.all([
    readActivity({ actor, action, take: PAGE_SIZE }),
    activityFacets(),
  ]);

  const filtered = !!(actor || action);
  const retention = Number(process.env.ACTIVITY_LOG_DAYS ?? 30);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/system" className="text-sm text-muted hover:underline">
          ← חזרה להגדרות מערכת
        </Link>
        <h1 className="mt-2 text-2xl font-bold">יומן פעילות</h1>
        <p className="mt-1 text-muted">
          מה משתמשים עשו במערכת, לטובת תחקור. {retention === 0 ? "נשמר ללא הגבלת זמן." : `נשמר ${retention} ימים אחורה.`} היומן
          רושם שבוצעה פעולה ועל מה — לא את הערכים שהשתנו; לשחזור תוכן יש גיבוי.
        </p>
      </div>

      <form method="get" action="/system/activity" className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col">
          <label htmlFor="actor" className="mb-1 text-sm text-muted">
            משתמש
          </label>
          <select id="actor" name="actor" defaultValue={actor ?? ""} className="rounded-md border border-border px-3 py-1.5 text-sm">
            <option value="">כל המשתמשים</option>
            {facets.actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.count})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col">
          <label htmlFor="action" className="mb-1 text-sm text-muted">
            סוג פעולה
          </label>
          <select id="action" name="action" defaultValue={action ?? ""} className="rounded-md border border-border px-3 py-1.5 text-sm">
            <option value="">כל הפעולות</option>
            {facets.actions.map((a) => (
              <option key={a.action} value={a.action}>
                {a.action} ({a.count})
              </option>
            ))}
          </select>
        </div>
        <button className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-stone-50">סנן</button>
        {filtered && (
          <Link href="/system/activity" className="rounded-md px-3 py-1.5 text-sm text-muted hover:underline">
            נקה
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <p className="text-muted">{filtered ? "אין רשומות התואמות לסינון." : "עדיין לא נרשמה פעילות."}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/70 bg-card shadow-sm">
          <table className="w-full text-start text-sm">
            <thead className="bg-stone-50 text-muted">
              <tr>
                <th className="px-4 py-2 text-start font-medium">מתי</th>
                <th className="px-4 py-2 text-start font-medium">מי</th>
                <th className="px-4 py-2 text-start font-medium">מה</th>
                <th className="px-4 py-2 text-start font-medium">סוג</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-stone-50">
                  <td className="whitespace-nowrap px-4 py-2 text-muted">{dt.format(r.createdAt)}</td>
                  <td className="whitespace-nowrap px-4 py-2 font-medium">{r.actorName}</td>
                  <td className="px-4 py-2">{r.description}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-muted">{r.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === PAGE_SIZE && (
            <p className="px-4 py-2 text-xs text-muted">מוצגות {PAGE_SIZE} הרשומות האחרונות. סנן כדי לצמצם.</p>
          )}
        </div>
      )}
    </div>
  );
}
