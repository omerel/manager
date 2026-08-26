"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FilterX, Trash2 } from "lucide-react";
import { versionedUrl } from "@/lib/upload-version";
import { ConfirmDelete, plural } from "@/components/ConfirmDelete";
import { removePerson } from "@/lib/person-actions";
import { destroysNothingElse, type DeletionImpact } from "@/lib/deletion-impact";

/**
 * The people table, filtered in the browser.
 *
 * The rows arrive already clipped to what this user may see, and the whole list
 * is loaded anyway (no pagination) — so filtering here is instant and cannot
 * widen visibility: the worst a bug can do is show too few rows.
 *
 * The cost, taken knowingly: filter state is not in the URL, so a filtered view
 * cannot be linked to and a reload clears it.
 */

export type PeopleRow = {
  id: string;
  fullName: string;
  orgPath: string;
  recruitmentDateLabel: string;
  status: string;
  statusLabel: string;
  planName: string | null;
  planTemplateId: string | null;
  photoPath: string | null;
  /** may the viewer remove this person — decided on the server by the same
   *  predicate `removePerson` enforces, per row because it follows their team */
  canDelete: boolean;
  /** counts the delete confirmation states; came down with the list, not on demand */
  impact: DeletionImpact;
};

const NO_PLAN_LABEL = "ללא מסלול";

type Filters = { name: string; org: string; date: string; status: string; plan: string };
const EMPTY: Filters = { name: "", org: "", date: "", status: "", plan: "" };

const has = (haystack: string, needle: string) =>
  haystack.toLowerCase().includes(needle.trim().toLowerCase());

/**
 * How many rows are rendered at once, and how many more each press reveals.
 *
 * The ceiling applies to the FILTERED rows, never to the loaded ones: filtering
 * still runs over everything the user may see, so a person past the ceiling is
 * still found. Measured reason for the ceiling: a thousand rows rendered at
 * once is 1.7MB of HTML and 68,000 DOM nodes, on a page 68 screens tall.
 */
const PAGE = 100;

export function PeopleTable({ rows }: { rows: PeopleRow[] }) {
  // the column exists when the viewer may delete anyone here; the control
  // itself is then per row, because authority follows each person's team
  const anyDeletable = rows.some((r) => r.canDelete);
  const [f, setF] = useState<Filters>(EMPTY);
  const [pendingDelete, setPendingDelete] = useState<PeopleRow | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const active = Object.values(f).some((v) => v !== "");

  // Closed-set filters offer only what is present in this user's own rows, so a
  // manager is never offered a filter that would return nothing.
  const statuses = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) seen.set(r.status, r.statusLabel);
    return [...seen.entries()];
  }, [rows]);

  const plans = useMemo(() => {
    const seen = new Set<string>();
    for (const r of rows) seen.add(r.planName ?? NO_PLAN_LABEL);
    return [...seen].sort((a, b) => a.localeCompare(b, "he"));
  }, [rows]);

  const shown = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!f.name || has(r.fullName, f.name)) &&
          (!f.org || has(r.orgPath, f.org)) &&
          (!f.date || has(r.recruitmentDateLabel, f.date)) &&
          (!f.status || r.status === f.status) &&
          (!f.plan || (r.planName ?? NO_PLAN_LABEL) === f.plan),
      ),
    [rows, f],
  );

  // a new filter shows its results from the top — otherwise a narrowed list
  // would inherit a ceiling raised for the previous, wider one
  useEffect(() => setLimit(PAGE), [f]);
  const visible = shown.slice(0, limit);

  const set = (k: keyof Filters) => (e: { target: { value: string } }) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-muted">
          {active ? (
            <>
              מוצגים <b>{shown.length}</b> מתוך {rows.length} אנשים
            </>
          ) : (
            <>{rows.length} אנשים בראות שלך. הרשימה חתוכה אוטומטית לפי ההרשאות.</>
          )}
        </span>
        {active && (
          <button
            type="button"
            onClick={() => setF(EMPTY)}
            className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-stone-50"
          >
            <FilterX className="h-3.5 w-3.5" aria-hidden />
            נקה סינון
          </button>
        )}
      </div>

      {/* the list scrolls inside its own area: the page stays about one screen
          tall however large the registry, and the sticky header keeps the
          column labels AND the filter row usable while the body scrolls */}
      <div className="max-h-[70vh] overflow-auto rounded-xl border border-border/70 bg-card shadow-sm">
        <table className="w-full text-start text-sm">
          <thead className="sticky top-0 z-10 bg-stone-50 text-muted shadow-[0_1px_0_var(--color-border)]">
            <tr>
              <Th>שם</Th>
              <Th>מסגרת</Th>
              <Th>מסלול קריירה</Th>
              <Th>תאריך גיוס</Th>
              <Th>סטטוס</Th>
              {anyDeletable && <th className="px-4 py-2 text-start font-medium sr-only">פעולות</th>}
            </tr>
            <tr className="border-t border-border">
              <Td>
                <TextFilter value={f.name} onChange={set("name")} placeholder="סנן שם…" />
              </Td>
              <Td>
                <TextFilter value={f.org} onChange={set("org")} placeholder="סנן מסגרת…" />
              </Td>
              <Td>
                <select value={f.plan} onChange={set("plan")} className={selectCls} aria-label="סנן מסלול">
                  <option value="">כל המסלולים</option>
                  {plans.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </Td>
              <Td>
                <TextFilter value={f.date} onChange={set("date")} placeholder="סנן תאריך…" />
              </Td>
              <Td>
                <select value={f.status} onChange={set("status")} className={selectCls} aria-label="סנן סטטוס">
                  <option value="">כל הסטטוסים</option>
                  {statuses.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Td>
              {anyDeletable && <Td> </Td>}
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => (
              <tr key={p.id} className="border-t border-border hover:bg-stone-50">
                <td className="px-4 py-2.5">
                  <Link
                    href={`/people/${p.id}`}
                    className="flex items-center gap-2.5 font-medium text-brand-800 hover:underline"
                  >
                    {p.photoPath ? (
                      <img
                        src={versionedUrl(`/photo/${p.id}`, p.photoPath)}
                        alt=""
                        className="h-8 w-8 rounded-full border border-border object-cover"
                      />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-800">
                        {p.fullName.slice(0, 1)}
                      </span>
                    )}
                    {p.fullName}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-muted">{p.orgPath}</td>
                <td className="px-4 py-2.5">
                  {p.planName === null ? (
                    <span className="text-muted">{NO_PLAN_LABEL}</span>
                  ) : p.planTemplateId ? (
                    // the template, not the person's copy: a list conveys which track they are on
                    <Link href={`/plans/${p.planTemplateId}`} className="text-brand-700 hover:underline">
                      {p.planName}
                    </Link>
                  ) : (
                    // the copy outlived its template; the name is still true, the destination is not
                    <span title="התבנית שממנה הועתק המסלול נמחקה">{p.planName}</span>
                  )}
                </td>
                <td className="px-4 py-2.5">{p.recruitmentDateLabel}</td>
                <td className="px-4 py-2.5">{p.statusLabel}</td>
                {anyDeletable && (
                  <td className="px-4 py-2.5 text-end">
                    {p.canDelete && (
                    <button
                      type="button"
                      onClick={() => setPendingDelete(p)}
                      title={`מחק את ${p.fullName}`}
                      className="rounded p-1 text-muted hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted">לא נמצאו אנשים התואמים לסינון.</p>
        )}

        {/* inside the scrolling area, so it meets the reader at the end of the
            rows instead of waiting below the fold of the page */}
        {shown.length > visible.length && (
          <div className="flex items-center justify-center gap-3 border-t border-border bg-stone-50/60 px-4 py-3 text-sm">
            <span className="text-muted">
              מוצגים <b>{visible.length}</b> מתוך {shown.length}
            </span>
            <button
              type="button"
              onClick={() => setLimit((n) => n + PAGE)}
              className="rounded-md border border-border bg-card px-3 py-1 text-xs hover:bg-stone-50"
            >
              הצג עוד {Math.min(PAGE, shown.length - visible.length)}
            </button>
          </div>
        )}
      </div>

      {pendingDelete && (
        <ConfirmDelete
          title={`מחיקת ״${pendingDelete.fullName}״`}
          confirmLabel="מחק את האיש וכל הרשום עליו"
          onCancel={() => setPendingDelete(null)}
          action={removePerson}
          hidden={{ personId: pendingDelete.id }}
        >
          <ImpactList impact={pendingDelete.impact} />
          <p className="text-muted">הפעולה אינה הפיכה. לשחזור נדרש גיבוי מלא (הגדרות מערכת ← גיבוי ונתונים).</p>
        </ConfirmDelete>
      )}
    </div>
  );
}

/**
 * The evidence in the confirmation. Only non-zero lines are drawn: on the
 * current registry 4 people in 10 have no history at all, and a column of
 * zeroes reads as gravity where there is none — so that case gets a sentence
 * instead.
 */
function ImpactList({ impact }: { impact: DeletionImpact }) {
  if (destroysNothingElse(impact)) {
    return <p className="text-muted">לאיש הזה אין היסטוריה במערכת — רק הרשומה עצמה תימחק.</p>;
  }
  const lines = [
    impact.planAssignments && plural(impact.planAssignments, "שיוך למסלול", "שיוכים למסלולים"),
    impact.evalEntries && plural(impact.evalEntries, "חוות דעת", "חוות דעת"),
    impact.attachments && plural(impact.attachments, "קובץ מצורף", "קבצים מצורפים"),
    impact.pointProgress && plural(impact.pointProgress, "אבן דרך שסומנה", "אבני דרך שסומנו"),
    impact.metricReadings && plural(impact.metricReadings, "קריאת מדד", "קריאות מדד"),
    impact.hasPhoto && "תמונת הפרופיל",
  ].filter((l): l is string => typeof l === "string");

  return (
    <>
      <p className="text-red-800">יימחקו יחד עם האיש:</p>
      <ul className="space-y-0.5 rounded-md bg-red-50 px-3 py-2 text-red-900">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      {impact.planAssignments > 0 && (
        <p className="text-amber-800">
          {plural(impact.planAssignments, "המסלול האישי שנוצר עבורו יימחק", "המסלולים האישיים שנוצרו עבורו יימחקו")} —
          תבניות המסלול עצמן אינן מושפעות.
        </p>
      )}
    </>
  );
}

const selectCls = "w-full rounded-md border border-border bg-card px-2 py-1 text-xs";

function TextFilter({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  placeholder: string;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      aria-label={placeholder}
      className="w-full rounded-md border border-border bg-card px-2 py-1 text-xs"
    />
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2 text-start font-medium">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2">{children}</td>;
}
