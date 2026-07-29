import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { computeVisibility } from "@/lib/access";
import { getSessionUser } from "@/lib/session";
import { getEditableTeams } from "@/lib/people";
import { getFieldDefs } from "@/lib/person-schema";
import { PersonFormFields } from "@/components/PersonFormFields";
import { createPerson } from "@/lib/person-actions";
import { extractForNewPerson } from "@/lib/extract-actions";
import { PendingButton } from "@/components/PendingButton";

export default async function NewPersonPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string; extract?: string }>;
}) {
  const { draft: draftId, extract } = await searchParams;
  const user = await getSessionUser();
  const visibility = await computeVisibility(user);
  const [teams, defs] = await Promise.all([getEditableTeams(visibility), getFieldDefs()]);

  // Draft pre-filled by the agent from a document (nothing persisted until save).
  const draft = draftId ? await prisma.personDraft.findFirst({ where: { id: draftId, createdBy: user.id } }) : null;
  const dv = (draft?.values ?? {}) as Record<string, string>;
  const draftDate = (s?: string) => {
    if (!s) return undefined;
    const d = new Date(s);
    return isNaN(d.getTime()) ? undefined : d;
  };
  const valueByDef: Record<string, string> = {};
  for (const [k, v] of Object.entries(dv)) {
    if (k.startsWith("field:")) valueByDef[k.slice(6)] = v;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/people" className="text-sm text-muted hover:underline">
          ← חזרה לאנשים
        </Link>
        <h1 className="mt-2 text-2xl font-bold">עובד חדש</h1>
      </div>

      {teams.length === 0 ? (
        <p className="text-muted">אין לך מסגרת עם הרשאת עריכה שאפשר לשייך אליה עובד.</p>
      ) : (
        <>
          {/* Create-from-document */}
          <section className="space-y-2 rounded-lg border border-dashed border-border bg-card/50 p-4">
            <h2 className="font-semibold">📄 יצירה ממסמך (אופציונלי)</h2>
            <p className="text-sm text-muted">
              העלה PDF / Word / Excel / טקסט — הסוכן ימלא את הטופס מראש ואת/ה בודק/ת ומאשר/ת לפני השמירה.
            </p>
            <form action={extractForNewPerson} className="flex flex-wrap items-end gap-2">
              <input type="file" name="document" required accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.md,.csv" className="text-sm" />
              <PendingButton
                pendingLabel="הסוכן מנתח את המסמך…"
                className="rounded-md border border-border px-4 py-1.5 text-sm hover:bg-slate-50"
              >
                נתח מסמך ומלא טופס
              </PendingButton>
              <p className="w-full text-xs text-muted">הניתוח לוקח עד דקה.</p>
            </form>
            {extract === "none" && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm text-amber-800">
                הסוכן לא מצא במסמך ערכים מתאימים — מלא/י ידנית.
              </div>
            )}
          </section>

          {draft && (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
              הטופס מולא מראש מהמסמך — בדוק/י את הערכים, השלם/י את החסר ולחץ/י ״צור עובד״ לאישור.
            </div>
          )}

          <form action={createPerson} className="space-y-4 rounded-lg border border-border bg-card p-5">
            {draft && <input type="hidden" name="draftId" value={draft.id} />}
            <div className="flex flex-col">
              <label htmlFor="teamId" className="mb-1 text-sm text-muted">
                שיוך לצוות
              </label>
              <select id="teamId" name="teamId" className="rounded-md border border-border px-3 py-1.5 text-sm">
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.path}
                  </option>
                ))}
              </select>
            </div>

            <PersonFormFields
              defs={defs}
              valueByDef={valueByDef}
              core={{
                fullName: dv["fullName"] ?? "",
                recruitmentDate: draftDate(dv["recruitmentDate"]) ?? null,
                endOfServiceDate: draftDate(dv["endOfServiceDate"]) ?? null,
              }}
            />

            <div className="flex flex-col">
              <label htmlFor="photo" className="mb-1 text-sm text-muted">
                תמונת פרופיל (אופציונלי)
              </label>
              <input id="photo" name="photo" type="file" accept="image/*" className="text-sm" />
            </div>

            <div className="flex gap-2">
              <button className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
                צור עובד
              </button>
              <Link href="/people" className="rounded-md border border-border px-4 py-1.5 text-sm hover:bg-slate-50">
                ביטול
              </Link>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
