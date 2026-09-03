import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { KIND_LABEL } from "@/lib/org-kinds";
import { addOrgNode } from "@/lib/org-actions";
import { addEnumOption, removeEnumOption } from "@/lib/person-actions";
import { HierarchyTree, type HierarchyNode } from "@/components/HierarchyTree";
import { OrgImport } from "@/components/OrgImport";
import { ActionForm } from "@/components/ActionForm";

const inputCls = "rounded-md border border-border px-3 py-1.5 text-sm";

export default async function HierarchyPage() {
  const me = await getSessionUser();
  if (me.role !== "ADMIN") redirect("/"); // exposed to admin only

  const [nodes, people, enumFields, commanders] = await Promise.all([
    prisma.orgNode.findMany(),
    prisma.person.findMany({ select: { teamId: true } }),
    prisma.personFieldDef.findMany({ where: { type: "ENUM" }, orderBy: { order: "asc" } }),
    prisma.user.findMany({ where: { commandsNodeId: { not: null } }, select: { name: true, commandsNodeId: true } }),
  ]);
  const commanderOf = new Map(commanders.map((c) => [c.commandsNodeId!, c.name]));

  const directCount = new Map<string, number>();
  for (const p of people) {
    if (p.teamId) directCount.set(p.teamId, (directCount.get(p.teamId) ?? 0) + 1);
  }
  // flat, serializable tree — the client component builds the hierarchy, rolls
  // up headcount, and computes the delete-confirmation facts from it
  const treeNodes: HierarchyNode[] = nodes.map((n) => ({
    id: n.id,
    name: n.name,
    kind: n.kind,
    parentId: n.parentId,
    direct: directCount.get(n.id) ?? 0,
    commander: commanderOf.get(n.id) ?? null,
  }));
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

      <OrgImport />

      <HierarchyTree nodes={treeNodes} />

      <ActionForm action={addOrgNode} className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border p-4">
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
        <button className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700">הוסף מסגרת</button>
        <p className="w-full text-xs text-muted">
          כלל: אב של תחום = מרכז · אב של מדור = תחום · אב של צוות = מדור. עריכה (✏️) מאפשרת לשנות שם, סוג ומסגרת אב.
          מחיקה מוחקת גם את תתי-המסגרות — יוצג אישור עם הפירוט; אנשים משויכים יעברו ל״ללא שיוך״.
        </p>
      </ActionForm>

      {/* Closed lists (specialties etc.) — the options behind ENUM card fields */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">התמחויות ורשימות סגורות</h2>
        <p className="text-sm text-muted">
          הערכים שמופיעים בשדות-בחירה בכרטיס העובד. הוספת רשימה חדשה נעשית דרך{" "}
          <Link href="/people/card-schema" className="text-brand-700 underline">שדות כרטיס</Link>{" "}
          (שדה מסוג ״בחירה״).
        </p>
        {enumFields.length === 0 ? (
          <p className="text-sm text-muted">אין רשימות סגורות מוגדרות.</p>
        ) : (
          <div className="space-y-3">
            {enumFields.map((f) => (
              <div key={f.id} className="rounded-xl border border-border/70 bg-card shadow-sm p-4">
                <div className="font-medium">{f.label}</div>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {f.options.map((o) => (
                    <li key={o} className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-sm">
                      <span>{o}</span>
                      <ActionForm action={removeEnumOption}>
                        <input type="hidden" name="fieldId" value={f.id} />
                        <input type="hidden" name="option" value={o} />
                        <button className="text-xs text-red-600 hover:underline">הסר</button>
                      </ActionForm>
                    </li>
                  ))}
                  {f.options.length === 0 && <li className="text-sm text-muted">אין ערכים ברשימה.</li>}
                </ul>
                <ActionForm action={addEnumOption} className="mt-3 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="fieldId" value={f.id} />
                  <input name="option" required placeholder="ערך חדש…" className={inputCls} />
                  <button className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-slate-50">הוסף</button>
                </ActionForm>
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
