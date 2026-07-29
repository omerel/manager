import Link from "next/link";
import { isAdmin } from "@/lib/authz";
import { getFieldDefs, FIELD_TYPE_LABEL } from "@/lib/person-schema";
import { addFieldDef, removeFieldDef, updateFieldDef, moveFieldDef } from "@/lib/person-actions";

const inputCls = "rounded-md border border-border px-3 py-1.5 text-sm";

export default async function CardSchemaPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit: editId } = await searchParams;
  const [admin, defs] = await Promise.all([isAdmin(), getFieldDefs()]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/people" className="text-sm text-muted hover:underline">
          ← חזרה לאנשים
        </Link>
        <h1 className="mt-2 text-2xl font-bold">סכימת כרטיס העובד</h1>
        <p className="mt-1 text-muted">
          שדות הליבה (שם, תאריך גיוס, סטטוס, סיום שירות, שיוך) קבועים. כאן האדמין מגדיר שדות אישיים נוספים,
          את סדר הצגתם ואת עריכתם.
        </p>
      </div>

      {!admin && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          הגדרת סכימת הכרטיס היא בסמכות האדמין בלבד.
        </div>
      )}

      <div className="rounded-xl border border-border/70 bg-card shadow-sm">
        <div className="border-b border-border px-4 py-2 text-sm text-muted">
          שדות ליבה קבועים: שם · תאריך גיוס · סטטוס · סיום שירות · צוות
        </div>
        {defs.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted">לא הוגדרו שדות נוספים.</p>
        ) : (
          <ul className="divide-y divide-border">
            {defs.map((d, i) =>
              admin && editId === d.id ? (
                <li key={d.id} className="bg-brand-50/60 px-4 py-3">
                  <form action={updateFieldDef} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={d.id} />
                    <div className="flex flex-col">
                      <label className="mb-1 text-xs text-muted">שם השדה</label>
                      <input name="label" defaultValue={d.label} required className={inputCls} />
                    </div>
                    <div className="flex flex-col">
                      <label className="mb-1 text-xs text-muted">סוג</label>
                      <select name="type" defaultValue={d.type} className={inputCls}>
                        <option value="TEXT">טקסט</option>
                        <option value="DATE">תאריך</option>
                        <option value="NUMBER">מספר</option>
                        <option value="ENUM">בחירה</option>
                      </select>
                    </div>
                    <div className="flex flex-col">
                      <label className="mb-1 text-xs text-muted">אפשרויות (לבחירה, בפסיקים)</label>
                      <input name="options" defaultValue={d.options.join(", ")} className={`${inputCls} w-64`} />
                    </div>
                    <label className="flex items-center gap-1 text-sm">
                      <input type="checkbox" name="required" defaultChecked={d.required} /> חובה
                    </label>
                    <button className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
                      שמור
                    </button>
                    <Link href="/people/card-schema" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-slate-50">
                      ביטול
                    </Link>
                  </form>
                  <p className="mt-1 text-xs text-muted">שינוי סוג/אפשרויות אינו משכתב ערכים שכבר הוזנו לאנשים.</p>
                </li>
              ) : (
                <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-2">
                  <span>
                    <span className="font-medium">{d.label}</span>{" "}
                    <span className="text-sm text-muted">
                      · {FIELD_TYPE_LABEL[d.type]}
                      {d.required ? " · חובה" : ""}
                      {d.type === "ENUM" && d.options.length > 0 ? ` · [${d.options.join(", ")}]` : ""}
                    </span>
                  </span>
                  {admin && (
                    <span className="flex items-center gap-2">
                      <form action={moveFieldDef}>
                        <input type="hidden" name="id" value={d.id} />
                        <input type="hidden" name="dir" value="up" />
                        <button disabled={i === 0} className="rounded border border-border px-1.5 py-0.5 text-xs disabled:opacity-30 hover:bg-slate-50" title="הזז למעלה">
                          ▲
                        </button>
                      </form>
                      <form action={moveFieldDef}>
                        <input type="hidden" name="id" value={d.id} />
                        <input type="hidden" name="dir" value="down" />
                        <button disabled={i === defs.length - 1} className="rounded border border-border px-1.5 py-0.5 text-xs disabled:opacity-30 hover:bg-slate-50" title="הזז למטה">
                          ▼
                        </button>
                      </form>
                      <Link href={`/people/card-schema?edit=${d.id}`} className="text-xs text-brand-700 hover:underline">
                        ערוך
                      </Link>
                      <form action={removeFieldDef}>
                        <input type="hidden" name="id" value={d.id} />
                        <button className="text-xs text-red-600 hover:underline">מחק</button>
                      </form>
                    </span>
                  )}
                </li>
              ),
            )}
          </ul>
        )}
      </div>

      {admin && (
        <form action={addFieldDef} className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border p-4">
          <div className="flex flex-col">
            <label htmlFor="label" className="mb-1 text-sm text-muted">שם השדה</label>
            <input id="label" name="label" required placeholder="למשל: השכלה" className={inputCls} />
          </div>
          <div className="flex flex-col">
            <label htmlFor="type" className="mb-1 text-sm text-muted">סוג</label>
            <select id="type" name="type" defaultValue="TEXT" className={inputCls}>
              <option value="TEXT">טקסט</option>
              <option value="DATE">תאריך</option>
              <option value="NUMBER">מספר</option>
              <option value="ENUM">בחירה</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label htmlFor="options" className="mb-1 text-sm text-muted">אפשרויות (לבחירה, מופרד בפסיקים)</label>
            <input id="options" name="options" placeholder="ראשון, שני, שלישי" className={inputCls} />
          </div>
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" name="required" /> חובה
          </label>
          <button className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700">הוסף שדה</button>
        </form>
      )}
    </div>
  );
}
