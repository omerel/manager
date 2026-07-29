import Link from "next/link";
import { computeVisibility } from "@/lib/access";
import { getSessionUser } from "@/lib/session";
import { isAdmin } from "@/lib/authz";
import { getVisiblePeople, STATUS_LABEL, formatDate } from "@/lib/people";

export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const user = await getSessionUser();
  const visibility = await computeVisibility(user);
  const [allPeople, admin] = await Promise.all([getVisiblePeople(visibility), isAdmin()]);

  const people = query
    ? allPeople.filter((p) => p.fullName.toLowerCase().includes(query.toLowerCase()))
    : allPeople;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">אנשים</h1>
          <p className="mt-1 text-muted">
            {query
              ? `${people.length} מתוך ${allPeople.length} אנשים · סינון לפי "${query}"`
              : `${allPeople.length} אנשים בראות שלך. הרשימה חתוכה אוטומטית לפי ההרשאות.`}
          </p>
        </div>
        <div className="flex gap-2">
          {admin && (
            <Link href="/people/card-schema" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-slate-50">
              שדות כרטיס
            </Link>
          )}
          <Link href="/people/new" className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
            עובד חדש
          </Link>
        </div>
      </div>

      <form method="get" action="/people" className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="חיפוש לפי שם…"
          className="w-64 rounded-md border border-border bg-card px-3 py-1.5 text-sm"
        />
        <button className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-slate-50">חפש</button>
        {query && (
          <Link href="/people" className="rounded-md px-3 py-1.5 text-sm text-muted hover:underline">
            נקה
          </Link>
        )}
      </form>

      {allPeople.length === 0 ? (
        <p className="text-muted">אין אנשים בהרשאה שלך.</p>
      ) : people.length === 0 ? (
        <p className="text-muted">לא נמצאו אנשים התואמים ל״{query}״.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-start text-sm">
            <thead className="bg-slate-50 text-muted">
              <tr>
                <Th>שם</Th>
                <Th>מסגרת</Th>
                <Th>תאריך גיוס</Th>
                <Th>סטטוס</Th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id} className="border-t border-border hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/people/${p.id}`} className="font-medium text-blue-700 hover:underline">
                      {p.fullName}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-muted">{p.orgPath}</td>
                  <td className="px-4 py-2.5">{formatDate(p.recruitmentDate)}</td>
                  <td className="px-4 py-2.5">{STATUS_LABEL[p.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2.5 text-start font-medium">{children}</th>;
}
