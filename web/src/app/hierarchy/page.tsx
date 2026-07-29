import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { KIND_LABEL } from "@/lib/org";
import { addOrgNode, removeOrgNode } from "@/lib/org-actions";
import { addEnumOption, removeEnumOption } from "@/lib/person-actions";
import type { OrgKind } from "@/generated/prisma/client";

const inputCls = "rounded-md border border-border px-3 py-1.5 text-sm";

type NodeLite = { id: string; name: string; kind: OrgKind; parentId: string | null };

function TreeRow({
  node,
  byParent,
  directCount,
  subtreeCount,
  depth,
}: {
  node: NodeLite;
  byParent: Map<string | null, NodeLite[]>;
  directCount: Map<string, number>;
  subtreeCount: Map<string, number>;
  depth: number;
}) {
  const children = (byParent.get(node.id) ?? []).sort((a, b) => a.name.localeCompare(b.name, "he"));
  const total = subtreeCount.get(node.id) ?? 0;
  const direct = directCount.get(node.id) ?? 0;
  return (
    <div>
      <div
        className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50"
        style={{ paddingInlineStart: `${depth * 20 + 8}px` }}
      >
        <span className="flex items-center gap-2">
          <span className="text-xs text-muted">{KIND_LABEL[node.kind]}</span>
          <span className="font-medium">{node.name}</span>
          <span className="text-xs text-muted">{`· ${total} ${total === 1 ? "איש" : "אנשים"}`}</span>
        </span>
        <div className="flex items-center gap-2">
          {direct > 0 && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
              {`מחיקה תנתק ${direct}`}
            </span>
          )}
          <form action={removeOrgNode}>
            <input type="hidden" name="id" value={node.id} />
            <button className="text-xs text-red-600 hover:underline">מחק</button>
          </form>
        </div>
      </div>
      {children.map((c) => (
        <TreeRow key={c.id} node={c} byParent={byParent} directCount={directCount} subtreeCount={subtreeCount} depth={depth + 1} />
      ))}
    </div>
  );
}

export default async function HierarchyPage() {
  const me = await getSessionUser();
  if (me.role !== "ADMIN") redirect("/"); // exposed to admin only

  const [nodes, people, enumFields] = await Promise.all([
    prisma.orgNode.findMany(),
    prisma.person.findMany({ select: { teamId: true } }),
    prisma.personFieldDef.findMany({ where: { type: "ENUM" }, orderBy: { order: "asc" } }),
  ]);

  const byParent = new Map<string | null, NodeLite[]>();
  for (const n of nodes) {
    const arr = byParent.get(n.parentId) ?? [];
    arr.push(n);
    byParent.set(n.parentId, arr);
  }

  const directCount = new Map<string, number>();
  for (const p of people) {
    if (p.teamId) directCount.set(p.teamId, (directCount.get(p.teamId) ?? 0) + 1);
  }
  // roll direct counts up the tree
  const subtreeCount = new Map<string, number>();
  const computeSubtree = (id: string): number => {
    if (subtreeCount.has(id)) return subtreeCount.get(id)!;
    const own = directCount.get(id) ?? 0;
    const kids = (byParent.get(id) ?? []).reduce((s, c) => s + computeSubtree(c.id), 0);
    const total = own + kids;
    subtreeCount.set(id, total);
    return total;
  };
  for (const n of nodes) computeSubtree(n.id);

  const roots = (byParent.get(null) ?? []).sort((a, b) => a.name.localeCompare(b.name, "he"));
  const unassigned = people.filter((p) => !p.teamId).length;

  const parentOptions = nodes
    .map((n) => ({ id: n.id, label: `${KIND_LABEL[n.kind]}: ${n.name}` }))
    .sort((a, b) => a.label.localeCompare(b.label, "he"));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">היררכיה והתמחויות</h1>
        <p className="mt-1 text-muted">
          מבנה המסגרות (מרכז ▸ תחום ▸ מדור ▸ צוות) והרשימות הסגורות של כרטיס העובד. המבנה מזין את ההרשאות; הרשימות מזינות את שדות הכרטיס.
        </p>
      </div>

      {unassigned > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          יש {unassigned} אנשים ללא שיוך למסגרת. ניתן לשייך אותם מחדש מכרטיס העובד.
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-2">
        {roots.length === 0 ? (
          <p className="px-2 py-2 text-sm text-muted">אין מסגרות עדיין. התחל ביצירת מרכז.</p>
        ) : (
          roots.map((r) => (
            <TreeRow key={r.id} node={r} byParent={byParent} directCount={directCount} subtreeCount={subtreeCount} depth={0} />
          ))
        )}
      </div>

      <form action={addOrgNode} className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border p-4">
        <div className="flex flex-col">
          <label htmlFor="name" className="mb-1 text-sm text-muted">שם המסגרת</label>
          <input id="name" name="name" required placeholder="למשל: תחום סייבר" className={inputCls} />
        </div>
        <div className="flex flex-col">
          <label htmlFor="kind" className="mb-1 text-sm text-muted">סוג</label>
          <select id="kind" name="kind" defaultValue="TEAM" className={inputCls}>
            <option value="CENTER">מרכז</option>
            <option value="DOMAIN">תחום</option>
            <option value="SECTION">מדור</option>
            <option value="TEAM">צוות</option>
          </select>
        </div>
        <div className="flex flex-col">
          <label htmlFor="parentId" className="mb-1 text-sm text-muted">מסגרת אב (ריק עבור מרכז)</label>
          <select id="parentId" name="parentId" defaultValue="" className={inputCls}>
            <option value="">— ללא (מרכז שורש)</option>
            {parentOptions.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </select>
        </div>
        <button className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700">הוסף מסגרת</button>
        <p className="w-full text-xs text-muted">
          כלל: אב של תחום = מרכז · אב של מדור = תחום · אב של צוות = מדור. מחיקה חסומה אם יש תת-מסגרות; אנשים משויכים יעברו ל״ללא שיוך״.
        </p>
      </form>

      {/* Closed lists (specialties etc.) — the options behind ENUM card fields */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">התמחויות ורשימות סגורות</h2>
        <p className="text-sm text-muted">
          הערכים שמופיעים בשדות-בחירה בכרטיס העובד. הוספת רשימה חדשה נעשית דרך{" "}
          <Link href="/people/card-schema" className="text-blue-700 underline">שדות כרטיס</Link>{" "}
          (שדה מסוג ״בחירה״).
        </p>
        {enumFields.length === 0 ? (
          <p className="text-sm text-muted">אין רשימות סגורות מוגדרות.</p>
        ) : (
          <div className="space-y-3">
            {enumFields.map((f) => (
              <div key={f.id} className="rounded-lg border border-border bg-card p-4">
                <div className="font-medium">{f.label}</div>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {f.options.map((o) => (
                    <li key={o} className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-sm">
                      <span>{o}</span>
                      <form action={removeEnumOption}>
                        <input type="hidden" name="fieldId" value={f.id} />
                        <input type="hidden" name="option" value={o} />
                        <button className="text-xs text-red-600 hover:underline">הסר</button>
                      </form>
                    </li>
                  ))}
                  {f.options.length === 0 && <li className="text-sm text-muted">אין ערכים ברשימה.</li>}
                </ul>
                <form action={addEnumOption} className="mt-3 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="fieldId" value={f.id} />
                  <input name="option" required placeholder="ערך חדש…" className={inputCls} />
                  <button className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-slate-50">הוסף</button>
                </form>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-muted">
          הסרת ערך אינה משנה אנשים שכבר הוזן להם הערך — הוא יישאר בכרטיסם עד שיעודכן.
        </p>
      </section>
    </div>
  );
}
