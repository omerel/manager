import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getLogoPath, getSystemName, DEFAULT_SYSTEM_NAME } from "@/lib/branding";
import { uploadLogo, resetLogo, updateSystemName } from "@/lib/branding-actions";
import { importBundle } from "@/lib/portability-actions";
import { AppLogo, LogoMark } from "@/components/Logo";
import { FileDrop } from "@/components/FileDrop";
import { Palette, DatabaseBackup, Download, Upload } from "lucide-react";

export default async function SystemSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ imported?: string; importError?: string }>;
}) {
  const { imported, importError } = await searchParams;
  const me = await getSessionUser();
  if (me.role !== "ADMIN") redirect("/");
  const logoPath = await getLogoPath();
  const customLogo = !!logoPath;
  const systemName = await getSystemName();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">הגדרות מערכת</h1>
          <p className="mt-1 text-muted">מיתוג ותצורה כלל-מערכתית (אדמין בלבד).</p>
        </div>
        <Link href="/system/activity" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-stone-50">
          יומן פעילות
        </Link>
      </div>

      <section className="space-y-4 rounded-xl border border-border/70 bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Palette className="h-5 w-5 text-brand-600" aria-hidden />
          מיתוג המערכת
        </h2>

        <form action={updateSystemName} className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col">
            <label htmlFor="systemName" className="mb-1 text-sm text-muted">
              שם המערכת (מוצג בסרגל, בהתחברות, בכותרת הדפדפן ובדוחות)
            </label>
            <input
              id="systemName"
              name="systemName"
              defaultValue={systemName}
              placeholder={DEFAULT_SYSTEM_NAME}
              className="w-72 rounded-md border border-border px-3 py-1.5 text-sm"
            />
          </div>
          <button className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
            שמור שם
          </button>
          <p className="w-full text-xs text-muted">{`ניקוי השדה מחזיר לברירת המחדל "${DEFAULT_SYSTEM_NAME}".`}</p>
        </form>
        <div className="flex items-center gap-4">
          <AppLogo logoPath={logoPath} size={48} />
          <div className="text-sm text-muted">
            {customLogo ? "לוגו מותאם-אישית פעיל." : "הלוגו המובנה (ברירת מחדל) פעיל."}
            <br />
            הלוגו מוצג בסרגל העליון ובמסך ההתחברות.
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <form action={uploadLogo} className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col">
              <label htmlFor="logo" className="mb-1 text-sm text-muted">העלאת לוגו (PNG / SVG / JPG)</label>
              <FileDrop name="logo" accept="image/*" required label="גרור/י לוגו לכאן (PNG / SVG / JPG)" className="min-w-72" />
            </div>
            <button className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
              החלף לוגו
            </button>
          </form>
          {customLogo && (
            <form action={resetLogo}>
              <button className="rounded-md border border-border px-4 py-1.5 text-sm hover:bg-stone-50">
                חזרה ללוגו המובנה
              </button>
            </form>
          )}
        </div>

        {!customLogo && (
          <div className="flex items-center gap-3 rounded-lg bg-brand-50 px-4 py-3">
            <LogoMark size={40} />
            <p className="text-sm text-brand-900">
              ״צמיחה״ — סימן הבית של המערכת: שלוש מדרגות עולות ועלה צומח.
            </p>
          </div>
        )}
      </section>

      {/* Backup & data portability */}
      <section className="space-y-4 rounded-xl border border-border/70 bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <DatabaseBackup className="h-5 w-5 text-brand-600" aria-hidden />
          גיבוי ונתונים
        </h2>

        {imported && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
            {imported} — ייתכן שתידרש התחברות מחדש עם משתמשי הגיבוי.
          </div>
        )}
        {importError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{importError}</div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2 rounded-lg border border-border/70 p-4">
            <h3 className="flex items-center gap-1.5 font-medium">
              <Download className="h-4 w-4 text-brand-600" aria-hidden /> ייצוא
            </h3>
            <p className="text-sm text-muted">
              <b>גיבוי מלא</b> — ZIP עם כל הנתונים והקבצים (כולל משתמשים וסיסמאות מוצפנות — לשמור במקום מאובטח).
              <br />
              <b>תצורה בלבד</b> — JSON של המבנה: מסגרות, שדות כרטיס, תבניות תכניות ומשתמשים, בלי אנשים.
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href="/system/export?scope=full"
                className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                הורד גיבוי מלא (ZIP)
              </a>
              <a
                href="/system/export?scope=config"
                className="rounded-md border border-border px-4 py-1.5 text-sm hover:bg-stone-50"
              >
                הורד תצורה (JSON)
              </a>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-red-200 bg-red-50/40 p-4">
            <h3 className="flex items-center gap-1.5 font-medium text-red-800">
              <Upload className="h-4 w-4" aria-hidden /> ייבוא / שחזור
            </h3>
            <p className="text-sm text-red-800/80">
              שחזור מגיבוי מלא <b>מוחק את כל הנתונים הקיימים</b> ומחליף אותם בתוכן הגיבוי.
              ייבוא תצורה מותר רק כשאין אנשים במרשם.
            </p>
            <form action={importBundle} className="space-y-2">
              <FileDrop name="bundle" required accept=".zip,.json" label="גרור/י חבילת גיבוי לכאן (ZIP / JSON)" />
              <label className="flex items-start gap-2 text-sm text-red-800">
                <input type="checkbox" name="confirm" className="mt-0.5" />
                אני מבין/ה שהייבוא ימחק את הנתונים הקיימים ויחליף אותם בתוכן הקובץ.
              </label>
              <button className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700">
                ייבא ושחזר
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
