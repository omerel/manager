import Link from "next/link";
import { computeVisibility } from "@/lib/access";
import { getSessionUser } from "@/lib/session";
import { isAdmin } from "@/lib/authz";
import { getVisiblePeople, STATUS_LABEL, formatDate } from "@/lib/people";
import { PeopleTable, type PeopleRow } from "@/components/PeopleTable";

export default async function PeoplePage() {
  const user = await getSessionUser();
  const visibility = await computeVisibility(user);
  const [people, admin] = await Promise.all([getVisiblePeople(visibility), isAdmin()]);

  // The server loads and permission-clips; filtering happens in the table over
  // exactly these rows, so it can only ever narrow them.
  const rows: PeopleRow[] = people.map((p) => ({
    id: p.id,
    fullName: p.fullName,
    orgPath: p.orgPath,
    recruitmentDateLabel: formatDate(p.recruitmentDate),
    status: p.status,
    statusLabel: STATUS_LABEL[p.status],
    planName: p.planName,
    planTemplateId: p.planTemplateId,
    photoPath: p.photoPath,
    impact: p.impact,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-bold">אנשים</h1>
        <div className="flex gap-2">
          {admin && (
            <Link href="/people/card-schema" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-stone-50">
              שדות כרטיס
            </Link>
          )}
          <Link href="/people/new" className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
            עובד חדש
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted">אין אנשים בהרשאה שלך.</p>
      ) : (
        <PeopleTable rows={rows} admin={admin} />
      )}
    </div>
  );
}
