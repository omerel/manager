"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useMemo, useState } from "react";
import { FilterX } from "lucide-react";
import { versionedUrl } from "@/lib/upload-version";

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
};

const NO_PLAN_LABEL = "ללא מסלול";

type Filters = { name: string; org: string; date: string; status: string; plan: string };
const EMPTY: Filters = { name: "", org: "", date: "", status: "", plan: "" };

const has = (haystack: string, needle: string) =>
  haystack.toLowerCase().includes(needle.trim().toLowerCase());

export function PeopleTable({ rows }: { rows: PeopleRow[] }) {
  const [f, setF] = useState<Filters>(EMPTY);
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

      <div className="overflow-x-auto rounded-xl border border-border/70 bg-card shadow-sm">
        <table className="w-full text-start text-sm">
          <thead className="bg-stone-50 text-muted">
            <tr>
              <Th>שם</Th>
              <Th>מסגרת</Th>
              <Th>מסלול קריירה</Th>
              <Th>תאריך גיוס</Th>
              <Th>סטטוס</Th>
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
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => (
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
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted">לא נמצאו אנשים התואמים לסינון.</p>
        )}
      </div>
    </div>
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
