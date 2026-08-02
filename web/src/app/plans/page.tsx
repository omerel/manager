import Link from "next/link";
import { getPlans, countAssignmentsByTemplate, countAllAssignmentsByTemplate } from "@/lib/plans";
import { isAdmin } from "@/lib/authz";
import { computeVisibility } from "@/lib/access";
import { getSessionUser } from "@/lib/session";
import { createPlan } from "@/lib/plan-actions";
import { PlanRowActions } from "@/components/PlanRowActions";

export default async function PlansPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const user = await getSessionUser();
  const visibility = await computeVisibility(user);
  const [allPlans, admin, assignedCounts, assignedEverywhere] = await Promise.all([
    getPlans(),
    isAdmin(),
    countAssignmentsByTemplate(visibility),
    // the delete confirmation must not narrow to what this admin manages
    countAllAssignmentsByTemplate(),
  ]);

  const plans = query
    ? allPlans.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    : allPlans;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">תכניות קריירה</h1>
        <p className="mt-1 text-muted">
          תבניות יחסיות לתאריך הגיוס. {admin ? "כאדמין את/ה יכול/ה ליצור, לערוך ולהעתיק." : "נערכות ע״י האדמין בלבד."}
        </p>
      </div>

      <form method="get" action="/plans" className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="חיפוש תכנית לפי שם…"
          className="w-64 rounded-md border border-border bg-card px-3 py-1.5 text-sm"
        />
        <button className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-slate-50">חפש</button>
        {query && (
          <Link href="/plans" className="rounded-md px-3 py-1.5 text-sm text-muted hover:underline">
            נקה
          </Link>
        )}
      </form>

      {admin && (
        <form action={createPlan} className="flex flex-wrap items-end gap-2 rounded-xl border border-border/70 bg-card shadow-sm p-4">
          <div className="flex flex-col">
            <label htmlFor="name" className="mb-1 text-sm text-muted">
              שם תכנית חדשה
            </label>
            <input
              id="name"
              name="name"
              required
              placeholder="למשל: מסלול חוקר"
              className="rounded-md border border-border px-3 py-1.5 text-sm"
            />
          </div>
          <button className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
            צור תכנית
          </button>
        </form>
      )}

      {allPlans.length === 0 ? (
        <p className="text-muted">אין תכניות עדיין.</p>
      ) : plans.length === 0 ? (
        <p className="text-muted">לא נמצאו תכניות התואמות ל״{query}״.</p>
      ) : (
        <ul className="space-y-3">
          {plans.map((p) => {
            const assigned = assignedCounts.get(p.id) ?? 0;
            return (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card shadow-sm p-4"
            >
              <div>
                <Link href={`/plans/${p.id}`} className="font-semibold text-brand-700 hover:underline">
                  {p.name}
                </Link>
                <div className="mt-1 text-sm text-muted">
                  {p._count.pointEvents} נקודתיים · {p._count.cumulativeMetrics} מצטברים ·{" "}
                  {p._count.recurringEvents} מחזוריים
                </div>
                <div className="mt-1 text-sm font-medium text-slate-700">
                  {`משויכים תחת ניהולי: ${assigned}`}
                </div>
              </div>
              {admin && (
                <PlanRowActions
                  planId={p.id}
                  name={p.name}
                  pointEvents={p._count.pointEvents}
                  cumulativeMetrics={p._count.cumulativeMetrics}
                  recurringEvents={p._count.recurringEvents}
                  assignedEverywhere={assignedEverywhere.get(p.id) ?? 0}
                />
              )}
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
